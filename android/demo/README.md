# NayutalGuard SDK — Android demo

日本語版: [README.ja.md](README.ja.md)

A minimal host app showing an end-to-end SDK integration: it gathers device
facts, hands them to the SDK, and renders the findings. Stock widgets, one
activity, no UI framework — the integration is the point, not the app.

This project is **standalone**. It consumes the shipped SDK artifact the same
way you will, so what builds here is what builds for you.

## Prerequisites

- JDK 17
- Android SDK with API 35 (`compileSdk = 35`, `minSdk = 26`)
- `ANDROID_HOME` set to your SDK location, or open the folder in Android Studio,
  which sets it for you

Gradle itself is vendored — use the included `./gradlew`, no separate install.

## 1. Get the SDK artifact

`nayutal-sdk-1.4.2.aar` comes from one of two places, and the bytes are the same:

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
shasum -a 256 nayutal-sdk-1.4.2.aar
```

Expected for `nayutal-sdk-1.4.2.aar`:

```text
e4e9c04972ff7d5dec71d84530ca318e6f7198899972fabce51c37fd9545a232
```

If it does not match, stop and tell us. Do not build against it.

## 3. Drop it in

```bash
mkdir -p libs
cp /path/to/nayutal-sdk-1.4.2.aar libs/
```

`libs/*.aar` is gitignored on purpose: the artifact is downloaded and verified,
never committed.

## 4. Supply your API key

The key is injected at build time and never written to source:

```bash
./gradlew assembleDebug -PNAYUTAL_API_KEY=your-key-here
```

For repeated builds, put it in `~/.gradle/gradle.properties` (outside this
project, so it cannot be committed by accident):

```properties
NAYUTAL_API_KEY=your-key-here
```

The endpoint defaults to production and is overridable the same way:

```bash
-PNAYUTAL_BASE_URL=https://<base-url-you-received>/
```

## 5. Build and run

```bash
./gradlew assembleDebug -PNAYUTAL_API_KEY=your-key-here
./gradlew installDebug  -PNAYUTAL_API_KEY=your-key-here   # device/emulator attached
```

Then launch **Nayutal SDK Demo** from the launcher, or:

```bash
adb shell am start -n com.nayutal.sdkdemo/.MainActivity
```

Tap **Run Scan**. The result block starts with the schema the SDK returned —
`schema 1.4.0` for this release — followed by one section per mechanism.

## Upgrading the SDK

A bare `.aar` carries no dependency metadata, so this project declares the SDK's
dependencies itself (see the `dependencies` block). When you move to a newer
artifact, re-check that list against the SDK's release notes.

Those dependencies do not all fail the same way, which is worth knowing before
you trust a green build:

- **Runtime** dependencies (okhttp, coroutines) are the dangerous ones. Leave one
  out and the app compiles perfectly cleanly, then dies with
  `NoClassDefFoundError` the first time it scans.
- **Compile-time** dependencies (`androidx.annotation`) fail immediately and
  visibly at build time. Its annotations are CLASS-retention, so the VM never
  loads them and they cannot cause a runtime failure.

So a successful build does not tell you the list is complete. Launch the app and
run a scan after any SDK upgrade.
