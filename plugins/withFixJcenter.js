const fs = require("fs");
const path = require("path");

const { withSettingsGradle } = require("expo/config-plugins");

/**
 * Expo config plugin that removes jcenter() from react-native-aes-gcm-crypto's build.gradle.
 * jcenter() was removed in Gradle 9 (Expo SDK 55) and mavenCentral() is already listed as a repo.
 */
const withFixJcenter = (config) => {
  return withSettingsGradle(config, (config) => {
    // Use a post-prebuild hook via dangerous mod to patch the library's build.gradle
    const buildGradlePath = path.resolve(
      config.modRequest.projectRoot,
      "..",
      "node_modules",
      "react-native-aes-gcm-crypto",
      "android",
      "build.gradle",
    );

    if (fs.existsSync(buildGradlePath)) {
      let contents = fs.readFileSync(buildGradlePath, "utf8");
      if (contents.includes("jcenter()")) {
        contents = contents.replace(/\s*jcenter\(\)\n?/g, "\n");
        fs.writeFileSync(buildGradlePath, contents, "utf8");
      }
    }

    return config;
  });
};

module.exports = withFixJcenter;
