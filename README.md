# NayutalGuard SDK — Demo Hosts

日本語版: [README.ja.md](README.ja.md)

Two minimal host applications for the NayutalGuard SDK, one per platform. Each is
a single screen — a scan button and streaming results — showing the complete
integration story: embed the artifact, inject credentials at build time, run a
scan, consume the event stream.

Both demos build against **SDK 1.9.0** and print results in **schema 1.8.0**.

They also show how a host uses the current API: init failure, feed state, could-not-measure reasons, observations, and the optional configuration fields added in 1.8.0 (a DNS baseline, the certificate check left on, a request-header provider).

| Demo | Platform | Consumes |
|---|---|---|
| [`android/demo`](android/demo/) | Android (Kotlin) | `nayutal-sdk-1.9.0.aar` in `libs/` |
| [`ios/SDKDemo`](ios/SDKDemo/) | iOS (Swift, XcodeGen) | `NayutalSDK.xcframework` in `Frameworks/` |

## The artifacts

The SDK package is delivered to integrators by Nayutal. Verify the artifact you
received against the published hashes before embedding; the values for 1.9.0 are:

| Artifact | SHA-256 |
|---|---|
| `nayutal-sdk-1.9.0.aar` | `52e6ebcd455f0fe5744697d0d8527694926bbd0e487b1620989b3e2993fc01d4` |
| `NayutalSDK-1.9.0.xcframework.zip` | `0cfaf77c7e444747622480bd23d8dc5c5ce247ede8941dea90816db041e5d4af` |

```bash
shasum -a 256 nayutal-sdk-1.9.0.aar NayutalSDK-1.9.0.xcframework.zip
```

The same table for every release is published at
**https://docs.nayutalguard.com/release-notes/**.

Full integration documentation: **https://docs.nayutalguard.com/**

## Where to go next

Each demo's README covers prerequisites, artifact placement, hash verification,
credential injection, and run instructions:

- Android: [android/demo/README.md](android/demo/README.md)
- iOS: [ios/SDKDemo/README.md](ios/SDKDemo/README.md)

Credentials (base URL + API key) are delivered separately and are never
committed — both demos inject them at build time.

## The certificate check stays on

Neither demo turns the SDK's certificate check off. Each demo's unit test asserts
that its configuration reads `certificateCheck` true, and on every push and pull
request `scripts/check-certificate-check.mjs` rejects any demo source that passes
`certificateCheck` anything but `true`.

## Keeping the two languages in step

`README.ja.md` mirrors this file. Every code block, version, hash and link in
the Japanese README is checked against the English one on every push and pull
request (`scripts/check-readme-drift.mjs`), and the Japanese file carries a pin
to the exact English revision it was translated from. A change to an English
README lands together with its Japanese twin, in the same commit.
