const { getDefaultConfig } = require("expo/metro-config");

const defaultConfig = getDefaultConfig(__dirname);

defaultConfig.transformer = {
  ...defaultConfig.transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer"),
};

defaultConfig.resolver = {
  ...defaultConfig.resolver,
  assetExts: [
    ...defaultConfig.resolver.assetExts.filter((ext) => ext !== "svg"),
    "onnx",
    "txt",
  ],
  // .sql files are imported via babel-plugin-inline-import (drizzle migrations
  // bundle). They must be source files so the babel transform sees them, not
  // assets that Metro would copy verbatim. Source extensions include them.
  sourceExts: [...defaultConfig.resolver.sourceExts, "svg", "sql"],
  blockList: [/\.test\.(ts|tsx)$/],
};

module.exports = defaultConfig;
