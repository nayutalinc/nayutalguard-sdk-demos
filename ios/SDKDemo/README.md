# NayutalGuard SDK — iOS demo

日本語版: [README.ja.md](README.ja.md)

A minimal host app showing an end-to-end SDK integration: it gathers device
facts, hands them to the SDK, and renders the findings. One SwiftUI file — the
integration is the point, not the app.

This project is **standalone**. It consumes the shipped XCFramework the same way
you will, so what builds here is what builds for you.

## Prerequisites

- Xcode 16 or newer (deployment target iOS 16.0)
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) — `brew install xcodegen`

The Xcode project is generated from `project.yml` rather than committed, so
there is no stale `.pbxproj` to merge.

## 1. Get the SDK artifact

`NayutalSDK-1.4.2.xcframework.zip` comes from one of two places, and the bytes are the same:

- the SDK package Nayutal handed you with your integration (the usual path), or
- the assets of the **sdk-v1.4.2** GitHub release, if your integration includes
  access to the `nayutalguard` repository (the page is not public):

```text
https://github.com/nayutalinc/nayutalguard/releases/tag/sdk-v1.4.2
```

Either way, verify the file against the published hash table in step 2 before
embedding it.

## 2. Verify it before you use it

The release notes publish a SHA-256 for every artifact. Check the file you
downloaded against the value on that page:

```bash
shasum -a 256 NayutalSDK-1.4.2.xcframework.zip
```

Expected for `NayutalSDK-1.4.2.xcframework.zip`:

```text
8c9d0321fd825c1e58d5304e3c67946058f6c4a3108f84dc1123052c5a23edbc
```

If it does not match, stop and tell us. Do not build against it.

## 3. Drop it in

```bash
mkdir -p Frameworks
unzip NayutalSDK-1.4.2.xcframework.zip -d Frameworks/
```

You should end up with `Frameworks/NayutalSDK.xcframework`. That path is
gitignored on purpose: the artifact is downloaded and verified, never committed.

## 4. Supply your API key

Credentials live in `Secrets.xcconfig`, which is gitignored. Copy the example
and fill it in:

```bash
cp Secrets.xcconfig.example Secrets.xcconfig
```

Then edit it:

```xcconfig
NAYUTAL_BASE_URL = https:/$()/<base-url-you-received>/
NAYUTAL_API_KEY = your-key-here
```

The `$()` in the URL is not a typo — it stops Xcode from reading `//` as the
start of a comment. The values flow into `Info.plist` at build time and are read
at launch, so the key never appears in source.

## 5. Generate, build, run

```bash
xcodegen generate
open SDKDemo.xcodeproj
```

Then pick a simulator and hit Run. From the command line:

```bash
xcodegen generate
xcodebuild -project SDKDemo.xcodeproj -scheme SDKDemo \
  -destination 'generic/platform=iOS Simulator' build
```

To build for one specific simulator instead, name a device you actually have
(`xcrun simctl list devices available`) rather than assuming a model:

```bash
xcodebuild -project SDKDemo.xcodeproj -scheme SDKDemo \
  -destination 'platform=iOS Simulator,name=iPhone 17' build
```

Tap **Run Scan**. The result block starts with the schema the SDK returned —
`schema 1.4.0` for this release — followed by one section per mechanism. On iOS
the trust-store check (D7) reports `SKIPPED`: the platform provides no
trust-store enumeration, and the SDK says so rather than guessing.

## Signing

`project.yml` leaves `DEVELOPMENT_TEAM` empty. A **simulator** build needs no
team and no signing identity, so the steps above work on any Mac as they are.
To run on a **physical device**, set `DEVELOPMENT_TEAM` in `project.yml` to your
own Apple team ID and run `xcodegen generate` again; Xcode then signs the app
with your team's development certificate.
