const fs = require("fs");
const path = require("path");

const { withDangerousMod } = require("expo/config-plugins");

/**
 * withFmtConstevalFix — unblocks the iOS build on Xcode 26+ / Apple clang 21.
 *
 * React Native 0.83 pins `fmt` 11.0.2, whose `format-inl.h` uses
 * `FMT_STRING` (→ `consteval`) in spots that the very strict consteval
 * evaluation in clang 21 rejects with:
 *   "call to consteval function ... is not a constant expression".
 *
 * fmt ships an escape hatch: defining `FMT_USE_CONSTEVAL=0` makes
 * `FMT_CONSTEVAL` fall back to `constexpr`, so the compile-time format-string
 * check is relaxed and the library builds. We append it to every pod target's
 * preprocessor definitions in the Podfile `post_install` (after
 * `react_native_post_install` so it isn't overwritten).
 *
 * CNG: `ios/Podfile` is generated, so this runs on every prebuild. The marker
 * guard keeps it idempotent. Remove this plugin once RN bumps fmt to ≥ 11.1.
 */
const MARKER = "withFmtConstevalFix";

const SNIPPET = `
    # ${MARKER}: fmt 11.0.2 + clang 21 consteval workaround.
    installer.pods_project.targets.each do |fmt_target|
      fmt_target.build_configurations.each do |fmt_config|
        defs = fmt_config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']
        defs = [defs] unless defs.is_a?(Array)
        defs << 'FMT_USE_CONSTEVAL=0' unless defs.include?('FMT_USE_CONSTEVAL=0')
        fmt_config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs
      end
    end`;

const withFmtConstevalFix = (config) => {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile",
      );
      if (!fs.existsSync(podfilePath)) return config;

      let contents = fs.readFileSync(podfilePath, "utf-8");
      if (contents.includes(MARKER)) return config;

      // Insert right after the `react_native_post_install(...)` call closes so
      // our define wins over anything RN's post-install sets. The closing paren
      // must be matched on its own line: the call's argument list contains a
      // nested `ccache_enabled?(podfile_properties)`, so a plain non-greedy
      // `...?\)` would stop at that inner paren and splice the snippet into the
      // middle of the argument list. Requiring `\n[ \t]*\)` skips the inner
      // paren (never newline-aligned) and matches the real terminator.
      const callRegex = /react_native_post_install\([\s\S]*?\n[ \t]*\)/;
      if (!callRegex.test(contents)) {
        // Don't silently no-op — a missed match means the fmt define never
        // lands and the iOS build breaks again with no hint why.
        console.warn(
          `[${MARKER}] react_native_post_install(...) not found in Podfile — ` +
            "fmt consteval workaround NOT applied.",
        );
        return config;
      }

      contents = contents.replace(callRegex, (match) => `${match}\n${SNIPPET}`);
      fs.writeFileSync(podfilePath, contents, "utf-8");
      return config;
    },
  ]);
};

module.exports = withFmtConstevalFix;
