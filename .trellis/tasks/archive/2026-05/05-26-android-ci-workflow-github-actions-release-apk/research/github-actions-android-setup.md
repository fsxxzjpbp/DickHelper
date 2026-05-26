# Research: GitHub Actions Android Build Setup

- **Query**: Android CI/CD build setup on GitHub Actions for Expo React Native project
- **Scope**: external (GitHub Actions ecosystem, runner images, Expo docs)
- **Date**: 2026-05-26

## Findings

---

### 1. Best Maintained GitHub Action for Java + Android SDK on ubuntu-latest

#### CRITICAL FINDING: ubuntu-latest (24.04) already ships Android SDK

The `ubuntu-latest` runner image (currently Ubuntu 24.04) has a **substantial Android SDK pre-installed**. This means you likely do NOT need `android-actions/setup-android` at all in most cases.

**Pre-installed Android components on ubuntu-latest (as of 2026-05-26):**

| Component | Version |
|---|---|
| `ANDROID_HOME` / `ANDROID_SDK_ROOT` | `/usr/local/lib/android/sdk` |
| Android Command Line Tools | 12.0 |
| Android SDK Build-tools | 37.0.0, 36.0.0/36.1.0, 35.0.0/35.0.1, 34.0.0 |
| Android SDK Platform-Tools | 37.0.0 |
| Android SDK Platforms | android-37, 36 (rev1-2 + ext18-19), 35 (rev2 + ext14-15), 34 (rev3 + ext8/10/11/12) |
| Android NDK | 27.3.13750724 (default) and 29.0.14206865 (latest) |
| CMake | 3.31.5 and 4.1.2 |
| Gradle | 9.5.1 (system-wide) |

**Pre-installed JDK versions on ubuntu-latest:**

| Version | Env Variable |
|---|---|
| 8.0.492+9 | `JAVA_HOME_8_X64` |
| 11.0.31+11 | `JAVA_HOME_11_X64` |
| **17.0.19+10 (default)** | `JAVA_HOME_17_X64` |
| 21.0.11+10 | `JAVA_HOME_21_X64` |
| 25.0.3+9 | `JAVA_HOME_25_X64` |

Source: https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md

#### Comparison: setup-android vs setup-java vs doing nothing

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| **Do nothing (rely on runner)** | Zero config; fastest CI; always up-to-date with runner image | Runner image updates can silently change SDK/platform versions; cmdline-tools is v12.0 (older — latest is v20.0) | **Recommended for most Expo/RN projects** unless you need a specific cmdline-tools version |
| **`android-actions/setup-android@v3`** | Installs specific cmdline-tools version (defaults to v20.0 latest); adds problem matchers; handles Windows path issues | Extra download time (~30-60s per run); redundant if runner already has SDK; separate from the official `actions/*` org | Use only if you need a cmdline-tools version newer than what the runner provides |
| **`android-actions/setup-android@v2`** | Same as v3 but older | Deprecated/no-longer-maintained path | Avoid |
| **`actions/setup-java@v4`** | Official action; caches JDK distributions; supports Temurin, Zulu, etc.; well-maintained (latest v4.6.0, Feb 2025) | Does NOT set up Android SDK (only Java) | Use for JDK version pinning; pair with the runner's pre-installed SDK |

**`android-actions/setup-android@v3` details:**
- Downloads cmdline-tools if not found at `$ANDROID_SDK_ROOT`
- Accepts SDK licenses
- Installs `tools` and `platform-tools` (configurable via `packages` input)
- Adds `platform-tools` and `cmdline-tools/<version>/bin` to `$PATH`
- Latest release: v3.2.0 (Apr 2025)
- Default cmdline-tools: v20.0 (long version 14742923)

**`actions/setup-java@v4` details:**
- Official GitHub action
- Supports caching of Gradle/Maven dependencies
- Supports distributions: temurin, zulu, adopt, liberica, microsoft, corretto, etc.
- Key inputs: `java-version`, `distribution`, `cache` (gradle/maven)
- Latest release: v4.6.0 (Feb 2025)

Source: https://github.com/android-actions/setup-android, https://github.com/actions/setup-java

#### Recommendation

For this project (Expo + React Native Android), the simplest and fastest approach is:

1. Use `actions/setup-java@v4` to pin JDK 17 with Temurin distribution and enable Gradle caching
2. **Skip** `android-actions/setup-android` entirely — the runner's pre-installed Android SDK is sufficient
3. Only add `setup-android` if the project requires a specific `compileSdk`/`buildToolsVersion` that the runner image does not provide (e.g., android-38+)

---

### 2. Standard Pattern for Signing Android APKs in CI

#### The Established Pattern (used across official docs and community)

**Step 1: Prepare keystore as a base64 secret**

Locally, encode your release keystore:

```bash
base64 -w0 path/to/release.keystore > keystore.b64
```

Add the base64 string to GitHub Secrets as `KEYSTORE_BASE64`.

**Step 2: Add signing credentials as individual secrets**

| Secret Name | Contents |
|---|---|
| `KEYSTORE_BASE64` | Base64-encoded `.jks` or `.keystore` file |
| `KEYSTORE_PASSWORD` | Keystore password |
| `KEY_ALIAS` | Key alias within the keystore |
| `KEY_PASSWORD` | Key password (often same as keystore password) |

**Step 3: Decode keystore in CI workflow**

```yaml
- name: Decode and write keystore
  run: |
    echo "${{ secrets.KEYSTORE_BASE64 }}" | base64 -d > android/app/release.keystore
```

Alternatively, use the `android-actions/create-keystore` action or write a small script.

**Step 4: Pass signing config to Gradle**

There are three common approaches:

**Approach A: Gradle signing config that reads env vars (recommended)**

In `android/app/build.gradle`:

```groovy
signingConfigs {
    release {
        storeFile file(System.getenv('KEYSTORE_FILE') ?: 'debug.keystore')
        storePassword System.getenv('KEYSTORE_PASSWORD') ?: 'android'
        keyAlias System.getenv('KEY_ALIAS') ?: 'androiddebugkey'
        keyPassword System.getenv('KEY_PASSWORD') ?: 'android'
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        // ...
    }
}
```

Then in the workflow:

```yaml
- name: Build release APK
  env:
    KEYSTORE_FILE: android/app/release.keystore
    KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
    KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
    KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}
  run: cd android && ./gradlew assembleRelease
```

**Approach B: Gradle properties via `~/.gradle/gradle.properties`**

```yaml
- name: Configure Gradle signing
  run: |
    echo "RELEASE_STORE_FILE=release.keystore" >> ~/.gradle/gradle.properties
    echo "RELEASE_STORE_PASSWORD=${{ secrets.KEYSTORE_PASSWORD }}" >> ~/.gradle/gradle.properties
    echo "RELEASE_KEY_ALIAS=${{ secrets.KEY_ALIAS }}" >> ~/.gradle/gradle.properties
    echo "RELEASE_KEY_PASSWORD=${{ secrets.KEY_PASSWORD }}" >> ~/.gradle/gradle.properties
```

Then in `build.gradle`:

```groovy
signingConfigs {
    release {
        storeFile file(RELEASE_STORE_FILE)
        storePassword RELEASE_STORE_PASSWORD
        keyAlias RELEASE_KEY_ALIAS
        keyPassword RELEASE_KEY_PASSWORD
    }
}
```

**Approach C: Project-level `gradle.properties` with `local.properties` pattern (less secure)**

Avoid this — it puts secrets in checked-in or generated files.

#### Current project signing state

The project (`apps/mobile/android/app/build.gradle`, lines 101-124) currently has:

```groovy
signingConfigs {
    debug {
        storeFile file('debug.keystore')
        storePassword 'android'
        keyAlias 'androiddebugkey'
        keyPassword 'android'
    }
}
buildTypes {
    release {
        // Caution! In production, you need to generate your own keystore file.
        signingConfig signingConfigs.debug  // <-- RELEASE CURRENTLY USES DEBUG KEY
    }
}
```

**Critical note**: The release build type currently falls back to the debug signing config. This MUST be changed to use a proper release keystore before publishing to any store. The existing `debug.keystore` at `apps/mobile/android/app/debug.keystore` is Expo's default debug keystore (password: `android`, alias: `androiddebugkey`) and should never be used for release builds.

#### Security considerations

- **Never** commit keystore files to the repository
- **Never** hardcode passwords in `build.gradle` (debug defaults are acceptable since debug keystores are not secret)
- GitHub Secrets are encrypted at rest and only decrypted during workflow execution
- Secrets are masked in build logs automatically by GitHub Actions
- Use `${{ secrets.X }}` (not env interpolation) — it also prevents secret values from being passed to forked PR workflows

---

### 3. Expo Prebuild in CI Before Gradle Build

#### What is `expo prebuild`?

`expo prebuild` (formerly `expo eject`) generates the native `android/` and `ios/` directories from the Expo app config (`app.json`). It is the bridge between the managed Expo JavaScript project and the native build system.

#### Does this project need `expo prebuild` in CI?

**No — the project already has prebuilt native directories.**

The `apps/mobile/android/` directory already exists with a full Gradle project structure:
- `apps/mobile/android/build.gradle`
- `apps/mobile/android/settings.gradle`
- `apps/mobile/android/app/build.gradle`
- `apps/mobile/android/gradlew`
- `apps/mobile/android/gradle/wrapper/gradle-wrapper.properties` (Gradle 8.14.3)

This means the project is using the **bare workflow** (prebuild already done and committed). CI can skip `expo prebuild` entirely.

#### Standard CI patterns for Expo projects

**Pattern A: Prebuild committed to repo (this project's pattern)**

```yaml
- name: Install dependencies
  run: npm install

- name: Build Android APK
  run: cd apps/mobile/android && ./gradlew assembleRelease
```

Simplest and fastest. The downside: native files can drift from JS config; developers must run `npx expo prebuild --clean` after `app.json` or plugin changes and commit the result.

**Pattern B: Prebuild in CI (clean-room approach)**

```yaml
- name: Install dependencies
  run: npm install

- name: Prebuild native projects
  run: npx expo prebuild --platform android --clean

- name: Build Android APK
  run: cd apps/mobile/android && ./gradlew assembleRelease
```

Guarantees the native code matches `app.json` exactly. Slower (adds 30-60s). Preferred when the `android/` directory is gitignored, or when you want CI to always be the source of truth.

**Pattern C: EAS Build (Expo's managed CI)**

```yaml
- name: Build with EAS
  run: npx eas build --platform android --profile release --non-interactive
```

Requires an Expo account and `eas.json` configuration. Fully managed — no Gradle or JDK setup needed at all. Expo handles everything on their servers.

#### When `expo prebuild` IS necessary in CI

Run `expo prebuild` in CI when:
1. You changed `app.json` plugins or native config
2. You upgraded Expo SDK or added/removed native modules
3. You do NOT commit the `android/` directory (it is in `.gitignore`)
4. You want a CI-clean build that guarantees `app.json` drives the native output

#### Gradle wrapper note

The project uses Gradle 8.14.3 (specified in `gradle-wrapper.properties`). The runner has Gradle 9.5.1 pre-installed, but the wrapper (`./gradlew`) will download and use the project's specified version automatically. No action needed.

---

### 4. JDK Version on ubuntu-latest Runner

**Default JDK: 17.0.19+10 (Temurin)**

| Version | Full Version | Env Variable | Distribution |
|---|---|---|---|
| **JDK 17 (default)** | 17.0.19+10 | `JAVA_HOME_17_X64` | Eclipse Temurin |
| JDK 8 | 8.0.492+9 | `JAVA_HOME_8_X64` | Eclipse Temurin |
| JDK 11 | 11.0.31+11 | `JAVA_HOME_11_X64` | Eclipse Temurin |
| JDK 21 | 21.0.11+10 | `JAVA_HOME_21_X64` | Eclipse Temurin |
| JDK 25 | 25.0.3+9 | `JAVA_HOME_25_X64` | Eclipse Temurin |

The default `JAVA_HOME` environment variable points to JDK 17.

For Android/Expo builds, **JDK 17 is the recommended version** — it is compatible with AGP (Android Gradle Plugin) 8.x and React Native 0.85.x.

If you need to pin a specific JDK version explicitly (best practice for reproducibility):

```yaml
- name: Set up JDK 17
  uses: actions/setup-java@v4
  with:
    java-version: '17'
    distribution: 'temurin'
    cache: 'gradle'
```

The `cache: 'gradle'` option significantly speeds up builds by caching `~/.gradle/caches` and `~/.gradle/wrapper` across workflow runs.

Source: https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md

---

## Related Project Files

| File Path | Description |
|---|---|
| `.github/workflows/release.yml` | Existing Electron release workflow (matrix: windows/mac/linux). This is the reference for adding an Android job. |
| `apps/mobile/app.json` | Expo config: `com.dickhelper.mobile`, SDK 56, Android-only |
| `apps/mobile/package.json` | Dependencies: expo ~56.0.4, react-native 0.85.3, expo-router ~56.2.6 |
| `apps/mobile/android/build.gradle` | Root Gradle build file |
| `apps/mobile/android/app/build.gradle` | App Gradle build file — contains current signing config (release uses debug key!) |
| `apps/mobile/android/settings.gradle` | Gradle settings with Expo autolinking |
| `apps/mobile/android/gradle/wrapper/gradle-wrapper.properties` | Gradle 8.14.3 wrapper config |
| `apps/mobile/android/app/debug.keystore` | Expo default debug keystore (do NOT use for release) |

## Related Specs

- `.trellis/spec/frontend/mobile-implementation.md` — mobile implementation spec (modified, uncommitted)
- The project is currently an Electron desktop app with a new mobile (Expo/React Native) module in `apps/mobile/`

## Caveats / Not Found

1. **Ubuntu runner image versioning**: The current `ubuntu-latest` is Ubuntu 24.04. GitHub periodically rolls this forward (22.04 -> 24.04 was mid-2024). Always check the runner readme before relying on specific pre-installed versions. Using `setup-java` and `setup-android` actions explicitly pins versions and avoids silent breakage from runner image updates.

2. **EAS Build vs self-hosted Gradle**: If this project plan to use EAS Build (Expo Application Services), then NONE of this GitHub Actions setup is needed — EAS handles the entire Android build pipeline on Expo's infrastructure. The existing `release.yml` workflow would only need a trigger job that calls `eas build`.

3. **Keystore generation**: This research does not cover how to generate a production keystore (done via `keytool -genkey ...`). That is a one-time local operation, not a CI concern.

4. **Google Play signing**: If using Google Play App Signing (recommended for Play Store), the upload key is different from the app signing key. The CI workflow only needs the upload key.
