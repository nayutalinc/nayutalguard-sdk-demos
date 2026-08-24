// Standalone build for the NayutalGuard SDK demo.
//
// This project is deliberately self-contained: it is NOT a module of the
// NayutalGuard app build. It consumes the SHIPPED SDK artifact exactly the way
// a partner does -- an .aar dropped into libs/ -- so that building it proves
// the integration works outside our repo. Building it as a subproject of our
// own build would prove nothing about that.
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "nayutalguard-sdk-demo"
