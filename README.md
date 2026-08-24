# NayutalGuard SDK — Demo Hosts

Two minimal host applications for the NayutalGuard SDK, one per platform. Each is
a single screen — a scan button and streaming results — showing the complete
integration story: embed the artifact, inject credentials at build time, run a
scan, consume the event stream.

| Demo | Platform | Consumes |
|---|---|---|
| [`android/demo`](android/demo/) | Android (Kotlin) | `nayutal-sdk-1.1.1.aar` in `libs/` |
| [`ios/SDKDemo`](ios/SDKDemo/) | iOS (Swift, XcodeGen) | `NayutalSDK.xcframework` in `Frameworks/` |

The SDK package is delivered to integrators by Nayutal. Verify the artifact you
received against the published hashes before embedding:
**https://docs.nayutalguard.com/release-notes/**

Full integration documentation: **https://docs.nayutalguard.com/**

Each demo's README covers prerequisites, artifact placement, hash verification,
credential injection, and run instructions. Credentials (base URL + API key) are
delivered separately and are never committed — both demos inject them at build
time.
