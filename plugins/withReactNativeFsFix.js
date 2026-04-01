const fs = require("fs");
const path = require("path");

const { withDangerousMod } = require("expo/config-plugins");

/**
 * Patches @dr.pogodin/react-native-fs for RN 0.83 compatibility.
 *
 * RN 0.83 codegen generates constantsToExport/getConstants returning
 * ModuleConstants<Constants::Builder>, but the library declares them as
 * ModuleConstants<Constants>. The C++ compiler treats these as distinct
 * types even though ObjC lightweight generics are erased at runtime.
 *
 * Fix: change both method signatures to match the codegen protocol, and
 * add a C-style cast on the typedConstants return value.
 *
 * RN 0.84 adds ResolveConstantsType to make these equivalent natively.
 * Tracked: https://github.com/birdofpreyru/react-native-fs/issues/139
 */
const withReactNativeFsFix = (config) => {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const filePath = path.join(
        config.modRequest.projectRoot,
        "node_modules/@dr.pogodin/react-native-fs/ios/ReactNativeFs.mm",
      );

      if (!fs.existsSync(filePath)) return config;

      let contents = fs.readFileSync(filePath, "utf-8");
      const builderType =
        "facebook::react::ModuleConstants<JS::NativeReactNativeFs::Constants::Builder>";
      const origType =
        "facebook::react::ModuleConstants<JS::NativeReactNativeFs::Constants>";

      // 1. Fix constantsToExport signature
      contents = contents.replace(
        `(${origType})constantsToExport`,
        `(${builderType})constantsToExport`,
      );

      // 2. Fix getConstants signature
      contents = contents.replace(
        `(${origType})getConstants`,
        `(${builderType})getConstants`,
      );

      // 3. Cast the typedConstants return value inside constantsToExport
      //    typedConstants<Constants>({...}) returns ModuleConstants<Constants>
      //    but the method now declares ModuleConstants<Constants::Builder>.
      //    ObjC generics are erased at runtime, so a C-style cast is safe.
      contents = contents.replace(
        "return facebook::react::typedConstants<JS::NativeReactNativeFs::Constants>(",
        `return (${builderType})facebook::react::typedConstants<JS::NativeReactNativeFs::Constants>(`,
      );

      // 4. Clean up any previous cast attempts on getConstants
      contents = contents.replace(
        `return (${builderType})[self constantsToExport];`,
        "return [self constantsToExport];",
      );

      fs.writeFileSync(filePath, contents, "utf-8");
      return config;
    },
  ]);
};

module.exports = withReactNativeFsFix;
