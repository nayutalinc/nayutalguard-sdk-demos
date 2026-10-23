import SwiftUI
import UIKit
import Network
import NayutalSDK

/// Minimal HOST app for the Nayutal SDK — the integration story:
/// a package dependency, a config with endpoint + key, one call per scan.
/// The SDK fetches its own data feeds (spec §6.2); this host implements
/// NOTHING but gathering device facts and rendering results.
/// Mirror of android/demo's MainActivity.
@main
struct SDKDemoApp: App {
    var body: some Scene {
        WindowGroup { ContentView() }
    }
}

struct ContentView: View {
    @StateObject private var model = ScanModel()

    var body: some View {
        VStack(spacing: 0) {
            Button(model.scanning ? "Scanning…" : "Run Scan") {
                model.runScan()
            }
            .disabled(model.scanning)
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color.accentColor.opacity(0.15))

            ScrollView {
                Text(model.output)
                    .font(.system(size: 13, design: .monospaced))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
            }
        }
        .onAppear {
            // Smoke-test hook: `simctl launch ... --autorun` runs one scan
            // on launch. Interactive use is unchanged.
            if ProcessInfo.processInfo.arguments.contains("--autorun") && !model.scanning {
                model.runScan()
            }
        }
    }
}

@MainActor
final class ScanModel: ObservableObject {
    @Published var output = """
    Press Run Scan.

    This host supplies NOTHING but device facts — the SDK fetches its \
    own feeds from the Nayutal backend (spec §6.2).
    """
    @Published var scanning = false

    // The integration surface: endpoint + this integration's key, plus the
    // optional fields in DemoSdkConfig.swift. Both arrive via Secrets.xcconfig
    // -> Info.plist at build time, never from source. A missing or blank key,
    // or a DNS baseline the SDK refuses, is a configuration error:
    // make(config:) throws it at startup, and this host shows it instead of
    // scanning (spec §6.2 - never a silent fallback, never "protected").
    private lazy var built: Result<NayutalScanner, Error> = {
        let info = Bundle.main.infoDictionary ?? [:]
        return Result {
            try NayutalScanner.make(config: DemoSdkConfig.make(
                baseUrl: info["NayutalBaseUrl"] as? String ?? "",
                apiKey: info["NayutalApiKey"] as? String ?? ""
            ))
        }
    }()

    func runScan() {
        let scanner: NayutalScanner
        switch built {
        case .success(let s):
            scanner = s
        case .failure(NayutalConfigurationError.apiKeyMissingOrEmpty):
            output = "SDK init failed: API key missing or empty.\nSet NayutalApiKey in Secrets.xcconfig; no scan runs without it."
            return
        case .failure(NayutalConfigurationError.dnsBaselineInvalid(let reason)):
            // The reason names the rule broken, never the value.
            output = "SDK init failed: \(reason)"
            return
        case .failure(let error):
            output = "SDK init failed: \(error)"
            return
        }
        scanning = true
        output = ""
        Task {
            var progress = ""
            // The streaming API: findings render the moment each mechanism
            // completes — no waiting for the slowest.
            for await event in scanner.runScanStreaming(
                environment: Self.gatherEnvironment(),
                deviceInfo: Self.gatherDeviceInfo()
            ) {
                switch event {
                case .scanStarted(let scanId, _):
                    progress += "scan \(scanId.prefix(8)) started…\n"
                case .contextClassified(let ctx):
                    progress += "network: \(ctx.type.rawValue) (multiplier \(ctx.riskMultiplier))\n"
                case .findingReady(let f):
                    progress += "\(f.mechanism.rawValue) done: raw=\(f.rawSeverity) adjusted=\(f.adjustedSeverity) [\(f.status.rawValue)]\n"
                case .scanCompleted(let result):
                    progress += "\n" + Self.render(result)
                    progress += "\n-- vpn reading (host probe) --\n"
                    progress += Self.describe(await DemoVpnProbe().vpnReading()) + "\n"
                }
                output = progress
            }
            scanning = false
        }
    }

    // ---- Host duty: device facts the SDK is not allowed to read itself ------

    static func gatherEnvironment() -> ScanEnvironment {
        UIDevice.current.isBatteryMonitoringEnabled = true
        let level = UIDevice.current.batteryLevel // -1 when unknown (simulator)
        let networkType: String = {
            let monitor = NWPathMonitor()
            defer { monitor.cancel() }
            let path = monitor.currentPath
            if path.usesInterfaceType(.wifi) { return "WIFI" }
            if path.usesInterfaceType(.wiredEthernet) { return "ETHERNET" }
            if path.usesInterfaceType(.cellular) { return "CELLULAR" }
            return "Unknown"
        }()
        return ScanEnvironment(
            batteryLevelPercent: level < 0 ? 100 : Int(level * 100),
            isCharging: UIDevice.current.batteryState == .charging
                || UIDevice.current.batteryState == .full,
            networkType: networkType,
            systemDnsServerIps: [] // host has no public API for these; empty is honest
        )
    }

    static func gatherDeviceInfo() -> DeviceInfo {
        DeviceInfo(
            deviceId: UIDevice.current.identifierForVendor?.uuidString ?? "demo-device",
            appVersion: "demo-0.1",
            osVersion: "iOS \(UIDevice.current.systemVersion)",
            locale: Locale.current.identifier,
            scanTrigger: "manual"
        )
    }

    // ---- Host duty: render the structured result as user-facing text --------

    static func render(_ r: SdkScanResult) -> String {
        var s = ""
        s += "schema \(r.schemaVersion) · scan \(r.scanId.prefix(8)) · \(r.durationMs) ms\n"
        s += "OVERALL raw=\(r.overall.rawSeverity) adjusted=\(r.overall.adjustedSeverity)\n"
        if !r.incompleteChecks.isEmpty {
            s += "did not measure: \(r.incompleteChecks.map { $0.rawValue }.joined(separator: ", "))\n"
        }
        // feedState per self-fetched feed: LIVE (fetched by this process), FALLBACK (built-in or earlier
        // data, with its age), HOST_SUPPLIED (an override source), UNCONFIGURED (keyless result), DISABLED
        // (certificate pins only: the host turned the certificate check off; this demo never does).
        s += "\n-- feeds --\n"
        for (name, status) in [("certificatePins", r.feeds.certificatePins), ("captivePortals", r.feeds.captivePortals)] {
            guard let status else { continue }
            s += "\(name): \(status.state.rawValue)"
            if let age = status.builtInDataAgeSeconds { s += " (data age \(age) s)" }
            s += "\n"
        }
        s += "\n-- network --\n"
        s += "\(r.networkContext.type.rawValue)  ssid=\(r.networkContext.ssid ?? "n/a")\n"
        s += "portal=\(r.networkContext.captivePortal) safeProxy=\(r.networkContext.knownSafeProxy) multiplier=\(r.networkContext.riskMultiplier)\n"
        // The baseline the DNS check compared against on this network (addresses and endpoint only); whether the
        // check ran is the D2 finding's status, below.
        if let b = r.networkContext.dnsBaseline {
            s += "dns baseline: \(b.udpServers.joined(separator: ", ")) + \(b.dohEndpoint)\n"
        }
        for f in r.findings {
            s += "\n-- \(f.mechanism.rawValue) --\n"
            if f.status == .measured {
                s += "raw=\(f.rawSeverity)"
                if let score = f.rawScore { s += " (score \(score))" }
                s += "  adjusted=\(f.adjustedSeverity)\n"
                for t in f.threats {
                    s += "  * \(t.category.rawValue) \(t.severity)\(t.subject.map { " [\($0)]" } ?? "")\n"
                    for code in t.codes.prefix(3) { s += "      \(code)\n" }
                }
                if f.threats.isEmpty { s += "  no threats\n" }
                // D3 only: a service this device does not trust but whose pinned certificate completed
                // the handshake. Measured valid, not a threat; shown as information.
                for u in f.trustChainUnverifiedByDevice ?? [] {
                    s += "  note: \(u.domain) chain not trusted by this device (anchor \(u.anchorSubject)); pinned certificate matched\n"
                }
            } else {
                // Not measured is never "safe": show the status and the machine-readable reason. A D2 check
                // held behind a captive-portal sign-in page reports reason captive_portal; it is neither a
                // threat nor a pass, and it runs once the sign-in completes.
                s += "\(f.status.rawValue): \(f.statusReason ?? "-")"
                if f.statusReason == "captive_portal" { s += " (held behind a sign-in page; not a threat, not a pass)" }
                s += "\n"
            }
            // Non-threat observations (for example weak_key:<host>): a host copies them into its own report;
            // they never change a severity.
            for o in f.observations { s += "  observation: \(o)\n" }
        }
        return s
    }

    static func describe(_ reading: SDKVpnReading) -> String {
        switch reading {
        case .vpn: return "vpn: a tunnel is active"
        case .noVpn: return "noVpn: the read ran and found no tunnel"
        case .unknown: return "unknown: the read failed or timed out; a VPN cannot be ruled out"
        @unknown default: return "unknown: a reading this demo does not know; a VPN cannot be ruled out"
        }
    }
}

/// The host's own VPN read, in the SDK's three-state form (spec §3.5.1). A failed or timed-out read answers
/// `.unknown`, never `.noVpn`: only a measured "no VPN" may soften a network-context finding. Implementing
/// `vpnReading()` is all a host does; `isVpnActive()` is the older Bool form. The scanner takes its own VPN read
/// inside a scan; a host passes a probe like this one to `NetworkContextAnalyzer` when it runs the analyzer itself.
/// Here it is shown after the scan, for display only.
struct DemoVpnProbe: SDKActiveVpnProbe {
    func isVpnActive() async -> Bool { await vpnReading() == .vpn }

    func vpnReading() async -> SDKVpnReading {
        await withCheckedContinuation { continuation in
            let monitor = NWPathMonitor()
            let queue = DispatchQueue(label: "demo.vpn.read")
            let once = OnceResume(continuation, monitor)
            monitor.pathUpdateHandler = { path in
                // Heuristic for a demo: a tunnel usually shows as an "other" interface; no path yet means no reading.
                // Only a satisfied path is a measurement; offline or pending says nothing about a tunnel.
                guard path.status == .satisfied else { return once.finish(.unknown) }
                once.finish(path.usesInterfaceType(.other) ? .vpn : .noVpn)
            }
            monitor.start(queue: queue)
            queue.asyncAfter(deadline: .now() + 2) { once.finish(.unknown) }
        }
    }
}

/// Resumes the continuation exactly once, from whichever of the path update or the timeout comes first.
private final class OnceResume: @unchecked Sendable {
    private let lock = NSLock()
    private var done = false
    private let continuation: CheckedContinuation<SDKVpnReading, Never>
    private let monitor: NWPathMonitor

    init(_ continuation: CheckedContinuation<SDKVpnReading, Never>, _ monitor: NWPathMonitor) {
        self.continuation = continuation
        self.monitor = monitor
    }

    func finish(_ reading: SDKVpnReading) {
        lock.lock(); defer { lock.unlock() }
        guard !done else { return }
        done = true
        monitor.cancel()
        continuation.resume(returning: reading)
    }
}
