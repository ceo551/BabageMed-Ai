plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace  = "com.pervagans.ai"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.pervagans.ai"
        minSdk        = 24      // Android 7.0 (covers ~96% of devices, Oct 2025 statcounter)
        targetSdk     = 34
        versionCode   = 1
        versionName   = "0.1.0"
        // Modern Android phones speak en + ar — match the web app.
        resourceConfigurations += listOf("en", "ar")
    }

    buildFeatures {
        compose   = true
        viewBinding = false
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled   = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
        getByName("debug") {
            applicationIdSuffix = ".debug"
            versionNameSuffix   = "-debug"
        }
    }

    packaging {
        resources {
            excludes += setOf("META-INF/AL2.0", "META-INF/LGPL2.1")
        }
    }
}

dependencies {
    // Compose BOM keeps every compose-* library on the same version.
    val composeBom = platform("androidx.compose:compose-bom:2024.06.00")
    implementation(composeBom)

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.1")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.webkit:webkit:1.11.0")  // WebSettingsCompat for dark mode
    implementation("androidx.biometric:biometric:1.2.0-alpha05")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
