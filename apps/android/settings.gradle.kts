// Top-level settings — declares the single module (`:app`) and the Gradle
// + AGP version catalogs that pin the toolchain for every contributor.
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
rootProject.name = "PervagansAI"
include(":app")
