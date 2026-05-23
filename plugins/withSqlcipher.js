/* eslint-env node */
/**
 * withSqlcipher — toggles expo-sqlite's SQLCipher build flag on both platforms.
 *
 * iOS:     sets `EXPO_SQLITE_USE_SQLCIPHER` extra in Podfile.properties.json
 *          (read by expo-sqlite's podspec at install time).
 * Android: sets `expo.sqlite.useSQLCipher=true` in gradle.properties (read
 *          by expo-sqlite's build.gradle to swap to a SQLCipher build).
 */
const {
  withPodfileProperties,
  withGradleProperties,
} = require("@expo/config-plugins");

const SQLCIPHER_KEY = "expo.sqlite.useSQLCipher";

const withSqlcipher = (config) => {
  config = withGradleProperties(config, (c) => {
    const props = c.modResults;
    const idx = props.findIndex(
      (p) => p.type === "property" && p.key === SQLCIPHER_KEY,
    );
    const entry = { type: "property", key: SQLCIPHER_KEY, value: "true" };
    if (idx >= 0) {
      props[idx] = entry;
    } else {
      props.push(entry);
    }
    return c;
  });

  config = withPodfileProperties(config, (c) => {
    c.modResults[SQLCIPHER_KEY] = "true";
    return c;
  });

  return config;
};

module.exports = withSqlcipher;
