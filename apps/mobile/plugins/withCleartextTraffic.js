/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { withAndroidManifest, AndroidConfig } = require("expo/config-plugins");

function withCleartextTraffic(config) {
    return withAndroidManifest(config, (mod) => {
        const mainApplication = AndroidConfig.Manifest.getMainApplication(mod.modResults);
        if (mainApplication?.$) {
            mainApplication.$["android:usesCleartextTraffic"] = "true";
        }
        return mod;
    });
}

module.exports = withCleartextTraffic;
