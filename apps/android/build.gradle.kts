// Root build script. The version catalogs declare the Android Gradle
// Plugin + Kotlin + Compose versions in one place so every module stays
// in lockstep. Bump these centrally when upgrading.

plugins {
    id("com.android.application") version "8.5.0" apply false
    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.0" apply false
}
