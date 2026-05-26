# Mobile Platform Docs Research

## Sources

- Expo monorepo guide: https://docs.expo.dev/guides/monorepos/
- Expo Router tabs guide: https://docs.expo.dev/router/advanced/tabs/
- Expo SQLite reference: https://docs.expo.dev/versions/latest/sdk/sqlite
- Expo APK build reference: https://docs.expo.dev/build-reference/apk/
- React Native Paper getting started: https://callstack.github.io/react-native-paper/docs/guides/getting-started/
- Expo SecureStore reference: https://docs.expo.dev/versions/latest/sdk/securestore

## Findings

- Expo officially supports monorepos through package manager workspaces and documents a root `workspaces` layout that can include `apps/*` and `packages/*`.
- Expo Router supports file-based tab layouts using a `(tabs)` route group and `Tabs` layout, which matches the proposed record/stats/prediction/history bottom-tab structure.
- `expo-sqlite` is the Expo-provided SQLite library and persists app-local databases across app restarts.
- EAS Build defaults Android distribution builds toward AAB for store distribution; direct install requires APK configuration such as `android.buildType: "apk"` or internal distribution. This supports treating GitHub Release APKs as a later binary distribution/update concern, not Phase 1 app logic.
- React Native Paper requires wrapping the app root in `PaperProvider`; this should be part of the mobile scaffold contract.
- Expo SecureStore exists and is the standard secure-storage option, but this project intentionally forbids it for Phase 1 because AI configuration storage is a product decision to remain in SQLite/plain app storage.

## Contract Implications

- `apps/mobile` is a valid target location for the Expo app under the root workspace strategy.
- Mobile routing should use Expo Router file-system layouts, not hand-written navigation state.
- Mobile persistence should use `expo-sqlite`, with schema semantics aligned to the desktop data contract.
- APK download/update behavior should be documented as deferred and not confused with Expo OTA updates.
- The implementation contract must explicitly state that rejecting SecureStore is intentional, not an omission.
