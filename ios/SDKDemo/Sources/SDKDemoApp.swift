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

    // The ENTIRE integration surface: endpoint + this integration's key.
    // Both arrive via Secrets.xcconfig -> Info.plist at build time,
    // never from source.
    private lazy var scanner: NayutalScanner = {
        let info = Bundle.main.infoDictionary ?? [:]
        return NayutalScanner.create(config: NayutalSdkConfig(
            baseUrl: info["NayutalBaseUrl"] as? String ?? "",
            apiKey: info["NayutalApiKey"] as? String ?? ""
        ))
    }()

    func runScan() {
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
        s += "\n-- network --\n"
        s += "\(r.networkContext.type.rawValue)  ssid=\(r.networkContext.ssid ?? "n/a")\n"
        s += "portal=\(r.networkContext.captivePortal) safeProxy=\(r.networkContext.knownSafeProxy) multiplier=\(r.networkContext.riskMultiplier)\n"
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
            } else {
                s += "\(f.status.rawValue): \(f.statusReason ?? "-")\n"
            }
        }
        return s
    }
}
