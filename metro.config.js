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
  sourceExts: [...defaultConfig.resolver.sourceExts, "svg"],
  blockList: [/\.test\.(ts|tsx)$/],
};

module.exports = defaultConfig;
