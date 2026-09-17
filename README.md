# NayutalGuard SDK — Demo Hosts

日本語版: [README.ja.md](README.ja.md)

Two minimal host applications for the NayutalGuard SDK, one per platform. Each is
a single screen — a scan button and streaming results — showing the complete
integration story: embed the artifact, inject credentials at build time, run a
scan, consume the event stream.

Both demos build against **SDK 1.4.2** and print results in **schema 1.4.0**.

| Demo | Platform | Consumes |
|---|---|---|
| [`android/demo`](android/demo/) | Android (Kotlin) | `nayutal-sdk-1.4.2.aar` in `libs/` |
| [`ios/SDKDemo`](ios/SDKDemo/) | iOS (Swift, XcodeGen) | `NayutalSDK.xcframework` in `Frameworks/` |

## The artifacts

The SDK package is delivered to integrators by Nayutal. Verify the artifact you
received against the published hashes before embedding; the values for 1.4.2 are:

| Artifact | SHA-256 |
|---|---|
| `nayutal-sdk-1.4.2.aar` | `e4e9c04972ff7d5dec71d84530ca318e6f7198899972fabce51c37fd9545a232` |
| `NayutalSDK-1.4.2.xcframework.zip` | `8c9d0321fd825c1e58d5304e3c67946058f6c4a3108f84dc1123052c5a23edbc` |

```bash
shasum -a 256 nayutal-sdk-1.4.2.aar NayutalSDK-1.4.2.xcframework.zip
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

## Keeping the two languages in step

`README.ja.md` mirrors this file. Every code block, version, hash and link in
the Japanese README is checked against the English one on every push and pull
request (`scripts/check-readme-drift.mjs`), and the Japanese file carries a pin
to the exact English revision it was translated from. A change to an English
README lands together with its Japanese twin, in the same commit.
