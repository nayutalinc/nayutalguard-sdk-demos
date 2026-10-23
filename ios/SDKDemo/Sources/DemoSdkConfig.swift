import NayutalSDK

/// The configuration this demo hands the SDK. Only `baseUrl` and `apiKey` are required; the three fields below are
/// optional (SDK 1.8.0) and are written out so an integrator can see them. Its unit test reads this function back.
enum DemoSdkConfig {
    static func make(baseUrl: String, apiKey: String) -> NayutalSdkConfig {
        NayutalSdkConfig(
            baseUrl: baseUrl,
            apiKey: apiKey,
            // The DNS baseline the DNS check compares against: exactly two plain DNS servers as IP literals, run by
            // different operators, and one DNS-over-HTTPS endpoint answering the JSON API. These are the SDK's built-in
            // values (one Google and one Cloudflare server, Cloudflare DNS-over-HTTPS). Naming a baseline differs from
            // leaving it unset in one way: a named server that is the phone's own DNS server is not queried in that
            // scan. Leave the field unset to use the built-in baseline.
            dnsBaseline: DnsBaseline(udpServers: ["8.8.8.8", "1.1.1.1"],
                                     dohEndpoint: "https://1.1.1.1/dns-query"),
            // The certificate check stays on (the default). Off, it reports SKIPPED on every scan and an interception
            // of a pinned service goes unreported; this demo never turns it off (scripts/check-certificate-check.mjs).
            certificateCheck: true,
            // Headers the SDK adds to its calls to baseUrl only, never to another host. Authorization and X-API-Key
            // stay the SDK's own. A fixed, non-identifying test header: a real host would send its own token here.
            requestHeaders: { ["X-Demo-Client": "nayutal-sdk-demo"] }
        )
    }
}
