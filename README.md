# NayutalGuard SDK — Demo Hosts

日本語版: [README.ja.md](README.ja.md)

Two minimal host applications for the NayutalGuard SDK, one per platform. Each is
a single screen — a scan button and streaming results — showing the complete
integration story: embed the artifact, inject credentials at build time, run a
scan, consume the event stream.

Both demos build against **SDK 1.7.1** and print results in **schema 1.7.0**.

They also show how a host uses the current API: init failure, feed state, could-not-measure reasons and observations.

| Demo | Platform | Consumes |
|---|---|---|
| [`android/demo`](android/demo/) | Android (Kotlin) | `nayutal-sdk-1.7.1.aar` in `libs/` |
| [`ios/SDKDemo`](ios/SDKDemo/) | iOS (Swift, XcodeGen) | `NayutalSDK.xcframework` in `Frameworks/` |

## The artifacts

The SDK package is delivered to integrators by Nayutal. Verify the artifact you
received against the published hashes before embedding; the values for 1.7.1 are:

| Artifact | SHA-256 |
|---|---|
| `nayutal-sdk-1.7.1.aar` | `44b99068afeadc08bca1f3f532dbdf401950c674b2cf550394d5b6b25482edf8` |
| `NayutalSDK-1.7.1.xcframework.zip` | `6013a4a22c3e1c57232d998a8bfca8fd9337c79fe1042b9a140f1729edf7d6d9` |

```bash
shasum -a 256 nayutal-sdk-1.7.1.aar NayutalSDK-1.7.1.xcframework.zip
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
