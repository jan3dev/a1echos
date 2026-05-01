const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const TEMPLATES_DIR = path.join(__dirname, "templates");

/**
 * Reads a template file from the android templates directory.
 */
function readTemplate(relativePath) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, relativePath), "utf8");
}

/**
 * Ensures a directory exists, creating it recursively if needed.
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Registers the EchosInputMethodService and ImeSettingsActivity in AndroidManifest.xml.
 */
function withImeManifest(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application?.[0];
    if (!mainApplication) {
      console.warn(
        "withAndroidIme: No <application> found in AndroidManifest.xml",
      );
      return config;
    }

    if (!mainApplication.service) {
      mainApplication.service = [];
    }
    if (!mainApplication.activity) {
      mainApplication.activity = [];
    }

    // Add InputMethodService
    const imeName = ".ime.EchosInputMethodService";
    const hasIme = mainApplication.service.some(
      (s) => s.$?.["android:name"] === imeName,
    );

    if (!hasIme) {
      mainApplication.service.push({
        $: {
          "android:name": imeName,
          "android:permission": "android.permission.BIND_INPUT_METHOD",
          "android:exported": "true",
        },
        "intent-filter": [
          {
            action: [{ $: { "android:name": "android.view.InputMethod" } }],
          },
        ],
        "meta-data": [
          {
            $: {
              "android:name": "android.view.im",
              "android:resource": "@xml/echos_keyboard_method",
            },
          },
        ],
      });
    }

    // Add ImeSettingsActivity
    const settingsName = ".ime.ImeSettingsActivity";
    const hasSettings = mainApplication.activity.some(
      (a) => a.$?.["android:name"] === settingsName,
    );

    if (!hasSettings) {
      mainApplication.activity.push({
        $: {
          "android:name": settingsName,
          "android:exported": "true",
          "android:label": "Echos Keyboard Settings",
        },
      });
    }

    return config;
  });
}

/**
 * Writes Kotlin source files and Android resources into the generated android/ directory.
 */
function withImeSources(config) {
  return withDangerousMod(config, [
    "android",
    (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidRoot = path.join(
        projectRoot,
        "android",
        "app",
        "src",
        "main",
      );

      // Kotlin source directory
      const imePackageDir = path.join(
        androidRoot,
        "java",
        "com",
        "a1lab",
        "echos",
        "ime",
      );
      ensureDir(imePackageDir);

      // Write Kotlin templates
      const ktFiles = [
        "EchosInputMethodService.kt",
        "EchosKeyboardView.kt",
        "EchosKeyboardTopBar.kt",
        "EchosKeyboardLayout.kt",
        "EchosWaveformView.kt",
        "SherpaModelManager.kt",
        "ImeSherpaTranscriber.kt",
        "RecordingLock.kt",
        "KeyFeedback.kt",
        "KeyTheme.kt",
        "ImeSettingsActivity.kt",
      ];

      for (const file of ktFiles) {
        const templatePath = path.join(TEMPLATES_DIR, file);
        if (fs.existsSync(templatePath)) {
          fs.writeFileSync(
            path.join(imePackageDir, file),
            fs.readFileSync(templatePath, "utf8"),
          );
        }
      }

      // Write XML resources
      const resDir = path.join(androidRoot, "res");

      // res/xml/echos_keyboard_method.xml
      const xmlDir = path.join(resDir, "xml");
      ensureDir(xmlDir);
      const methodXmlPath = path.join(
        TEMPLATES_DIR,
        "res",
        "echos_keyboard_method.xml",
      );
      if (fs.existsSync(methodXmlPath)) {
        fs.writeFileSync(
          path.join(xmlDir, "echos_keyboard_method.xml"),
          fs.readFileSync(methodXmlPath, "utf8"),
        );
      }

      // res/values/keyboard_colors.xml
      const valuesDir = path.join(resDir, "values");
      ensureDir(valuesDir);
      const colorsPath = path.join(TEMPLATES_DIR, "res", "keyboard_colors.xml");
      if (fs.existsSync(colorsPath)) {
        fs.writeFileSync(
          path.join(valuesDir, "keyboard_colors.xml"),
          fs.readFileSync(colorsPath, "utf8"),
        );
      }

      // res/values-night/keyboard_colors.xml
      const valuesNightDir = path.join(resDir, "values-night");
      ensureDir(valuesNightDir);
      const colorsNightPath = path.join(
        TEMPLATES_DIR,
        "res",
        "keyboard_colors_night.xml",
      );
      if (fs.existsSync(colorsNightPath)) {
        fs.writeFileSync(
          path.join(valuesNightDir, "keyboard_colors.xml"),
          fs.readFileSync(colorsNightPath, "utf8"),
        );
      }

      // res/drawable/ — vector icons for the keyboard (logo, mic, stop, emoji)
      const drawableDir = path.join(resDir, "drawable");
      ensureDir(drawableDir);
      const drawableSrc = path.join(TEMPLATES_DIR, "res", "drawable");
      if (fs.existsSync(drawableSrc)) {
        for (const entry of fs.readdirSync(drawableSrc)) {
          if (!entry.endsWith(".xml")) continue;
          fs.writeFileSync(
            path.join(drawableDir, entry),
            fs.readFileSync(path.join(drawableSrc, entry), "utf8"),
          );
        }
      }

      // res/values/keyboard_dimens.xml
      const dimensPath = path.join(TEMPLATES_DIR, "res", "keyboard_dimens.xml");
      if (fs.existsSync(dimensPath)) {
        fs.writeFileSync(
          path.join(valuesDir, "keyboard_dimens.xml"),
          fs.readFileSync(dimensPath, "utf8"),
        );
      }

      return config;
    },
  ]);
}

/**
 * `react-native-sherpa-onnx` ships the `com.k2fsa.sherpa.onnx.*` Kotlin API as
 * an `implementation`-scoped JAR inside its own Gradle module, which means the
 * classes are NOT transitively visible to consumers (they're runtime-only on
 * the AAR's `libs/`). The IME's `ImeSherpaTranscriber` compiles directly
 * against those classes, so we need to add the same JAR to the app module's
 * compile classpath. The `.builtBy(...)` wires the existing extract task so
 * Gradle produces the JAR before our `:app:compileDebugKotlin` runs.
 */
function withImeGradleDeps(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      console.warn(
        "withAndroidIme: app build.gradle is not Groovy; skipping sherpa-onnx classes injection.",
      );
      return config;
    }
    const marker =
      "// Echos IME — expose sherpa-onnx Kotlin API to app sources";
    if (config.modResults.contents.includes(marker)) {
      return config;
    }
    // Escape `\${...}` so JS template-literal interpolation doesn't eat the
    // Groovy `${rootProject.projectDir}` reference.
    const block = `
${marker}
dependencies {
    implementation fileTree(
        dir: "\${rootProject.projectDir}/../node_modules/react-native-sherpa-onnx/android/build/sherpa-onnx-classes",
        include: ["*.jar"],
    ).builtBy(":react-native-sherpa-onnx:extractSherpaOnnxClasses")
}
`;
    config.modResults.contents = config.modResults.contents.trimEnd() + block;
    return config;
  });
}

/**
 * Composes Android IME manifest registration and source file generation.
 */
function withAndroidIme(config) {
  config = withImeManifest(config);
  config = withImeSources(config);
  config = withImeGradleDeps(config);
  return config;
}

module.exports = { withAndroidIme };
