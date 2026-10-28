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

`NayutalSDK-1.10.0.xcframework.zip` comes from one of two places, and the bytes are the same:

- the SDK package Nayutal handed you with your integration (the usual path), or
- the assets of the **sdk-v1.10.0** GitHub release, if your integration includes
  access to the `nayutalguard` repository (the page is not public):

```text
https://github.com/nayutalinc/nayutalguard/releases/tag/sdk-v1.10.0
```

Either way, verify the file against the published hash table in step 2 before
embedding it.

## 2. Verify it before you use it

The release notes publish a SHA-256 for every artifact. Check the file you
downloaded against the value on that page:

```bash
shasum -a 256 NayutalSDK-1.10.0.xcframework.zip
```

Expected for `NayutalSDK-1.10.0.xcframework.zip`:

```text
8c58596f52faf1534d5a02ec79dfd214d20dc8900630413ff4f8767784d1d697
```

If it does not match, stop and tell us. Do not build against it.

## 3. Drop it in

```bash
mkdir -p Frameworks
unzip NayutalSDK-1.10.0.xcframework.zip -d Frameworks/
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
`schema 1.8.0` for this release — followed by one section per mechanism. On iOS
the trust-store check (D7) reports `SKIPPED`: the platform provides no
trust-store enumeration, and the SDK says so rather than guessing.

The demo also shows the host side of the current API: a missing key surfaces as `NayutalConfigurationError` and no scan runs, `feeds` reports each feed's state, findings that did not measure show their status and reason (a D2 check held behind a sign-in page reports `captive_portal`), `observations` such as `weak_key:<host>` are printed without changing any severity, and a host `SDKActiveVpnProbe` implements `vpnReading()` so a read that fails answers `.unknown`, never `.noVpn`.

Its SDK configuration, in `DemoSdkConfig.swift`, also writes out the three optional fields added in 1.8.0: `dnsBaseline` at the SDK's built-in values, `certificateCheck` left on, and a `requestHeaders` provider that adds one fixed test header, `X-Demo-Client`, to the SDK's calls to the base URL. The network section prints the DNS baseline each scan used. Naming a baseline differs from leaving the field unset in one way: a named server that is the phone's own DNS server is not queried in that scan.

The demo never turns the certificate check off. Its unit test (the `SDKDemoTests` target) asserts that, and CI rejects any demo source that passes `certificateCheck` anything but `true` (`scripts/check-certificate-check.mjs`):

```bash
xcodebuild -project SDKDemo.xcodeproj -scheme SDKDemo \
  -destination 'platform=iOS Simulator,name=iPhone 17' test
```

## Signing

`project.yml` leaves `DEVELOPMENT_TEAM` empty. A **simulator** build needs no
team and no signing identity, so the steps above work on any Mac as they are.
To run on a **physical device**, set `DEVELOPMENT_TEAM` in `project.yml` to your
own Apple team ID and run `xcodegen generate` again; Xcode then signs the app
with your team's development certificate.
