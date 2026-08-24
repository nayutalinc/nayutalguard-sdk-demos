// Minimal host app showcasing the NayutalGuard SDK.
// Plays the "embedder" role: gathers device facts, supplies data sources,
// renders findings. No UI framework — stock widgets, one file.
//
// Standalone project: plugin versions are pinned here rather than inherited
// from a parent build, so this builds from a bare clone.
plugins {
    id("com.android.application") version "8.13.2"
    id("org.jetbrains.kotlin.android") version "2.0.21"
}

android {
    namespace = "com.nayutal.sdkdemo"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.nayutal.sdkdemo"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1"

        // API key injected at build time (-PNAYUTAL_API_KEY=... or gradle.properties),
        // never committed to source. Same mechanism as the main app.
        val apiKey = (project.findProperty("NAYUTAL_API_KEY") ?: "").toString()
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
        buildConfigField("String", "NAYUTAL_API_KEY", "\"$apiKey\"")

        // Base URL overridable per environment (-PNAYUTAL_BASE_URL=...)
        val baseUrl = (project.findProperty("NAYUTAL_BASE_URL") ?: "https://api.nayutalguard.com/").toString()
        buildConfigField("String", "BASE_URL", "\"$baseUrl\"")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    // The SHIPPED SDK artifact. Download it from the sdk-v1.1.1 release and
    // drop it in libs/ — see README.md. It is not committed: you are meant to
    // verify its SHA-256 against the release notes before using it.
    implementation(files("libs/nayutal-sdk-1.1.1.aar"))

    // The SDK's own dependencies, declared explicitly.
    //
    // A bare .aar carries no POM or module metadata, so consuming it via files()
    // resolves NOTHING transitively. These are what the SDK declares as
    // implementation(...) dependencies, and they fail in two different ways:
    //
    //   androidx.annotation is a COMPILE-time need. Its annotations are
    //   CLASS/BINARY retention, so the VM never loads them and they can never
    //   produce a runtime error — but the compiler needs them on the classpath
    //   to resolve the SDK's annotated public API.
    //
    //   okhttp3 and kotlinx-coroutines are RUNTIME needs, and they are the
    //   dangerous shape: omit them and the app compiles perfectly clean, then
    //   dies with NoClassDefFoundError the first time it scans. A green build
    //   is not evidence that this list is complete — run the app.
    //
    // Keep this list in step with the SDK's own dependencies when upgrading.
    implementation("androidx.annotation:annotation:1.8.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
}
