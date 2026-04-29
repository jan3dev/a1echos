const { withProjectBuildGradle } = require("expo/config-plugins");

const NDK_VERSION = "28.1.13356709";

const withNdkVersion = (config) => {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      throw new Error(
        "withNdkVersion expects android/build.gradle to be groovy",
      );
    }

    let contents = config.modResults.contents;

    if (contents.includes("ext.ndkVersion")) {
      contents = contents.replace(
        /ext\.ndkVersion\s*=\s*['"][^'"]+['"]/,
        `ext.ndkVersion = "${NDK_VERSION}"`,
      );
    } else {
      contents = `ext.ndkVersion = "${NDK_VERSION}"\n\n` + contents;
    }

    config.modResults.contents = contents;
    return config;
  });
};

module.exports = withNdkVersion;
