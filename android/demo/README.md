# NayutalGuard SDK — Android demo

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

Download `nayutal-sdk-1.4.2.aar` from the **sdk-v1.4.2** release notes page:

    https://docs.nayutalguard.com/release-notes/
    (the SDK package itself is delivered to integrators by Nayutal; verify the
    artifact hash against that page before embedding)

If you received the SDK out-of-band (a delivery link rather than repo access),
use the artifact and checksum from that delivery — they are the same bytes.

## 2. Verify it before you use it

The release notes publish a SHA-256 for every artifact. Check the file you
downloaded against the value on that page:

    shasum -a 256 nayutal-sdk-1.4.2.aar

Expected for `nayutal-sdk-1.4.2.aar`:

    e4e9c04972ff7d5dec71d84530ca318e6f7198899972fabce51c37fd9545a232

If it does not match, stop and tell us. Do not build against it.

## 3. Drop it in

    mkdir -p libs
    cp /path/to/nayutal-sdk-1.4.2.aar libs/

`libs/*.aar` is gitignored on purpose: the artifact is downloaded and verified,
never committed.

## 4. Supply your API key

The key is injected at build time and never written to source:

    ./gradlew assembleDebug -PNAYUTAL_API_KEY=your-key-here

For repeated builds, put it in `~/.gradle/gradle.properties` (outside this
project, so it cannot be committed by accident):

    NAYUTAL_API_KEY=your-key-here

The endpoint defaults to production and is overridable the same way:

    -PNAYUTAL_BASE_URL=https://<base-url-you-received>/

## 5. Build and run

    ./gradlew assembleDebug -PNAYUTAL_API_KEY=your-key-here
    ./gradlew installDebug  -PNAYUTAL_API_KEY=your-key-here   # device/emulator attached

Then launch **NayutalGuard SDK Demo** from the launcher, or:

    adb shell am start -n com.nayutal.sdkdemo/.MainActivity

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
