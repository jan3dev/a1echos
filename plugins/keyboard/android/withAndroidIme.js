const fs = require("fs");
const path = require("path");

const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
} = require("expo/config-plugins");

const TEMPLATES_DIR = path.join(__dirname, "templates");

// LM reranker (context-aware autocorrect): prebuilt llama.cpp static libs,
// produced locally by scripts/keyboard-lm/build-llama-android.sh
// (git-ignored). When absent the native module is skipped entirely and
// LmReranker.kt degrades at runtime — the keyboard builds exactly as before.
const LM_VENDOR_DIR = path.join(__dirname, "vendor", "keyboard-lm");

function lmEnabled() {
  return fs.existsSync(LM_VENDOR_DIR);
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
        "KeyboardViewUtils.kt",
        "KeyDeleteRepeater.kt",
        "EmojiData.kt",
        "EmojiSearchIndex.kt",
        "EchosEmojiPickerView.kt",
        "EchosEmojiSearchOverlayView.kt",
        "AccentVariants.kt",
        "KeyOverlayView.kt",
        "SkinTonePopupView.kt",
        "EmojiCellTextView.kt",
        "ImeSettingsActivity.kt",
        "SpacingAndPunctuations.kt",
        "AutoCapEngine.kt",
        "DoubleSpacePeriod.kt",
        "RecapitalizeEngine.kt",
        "KeyboardSettings.kt",
        "SuggestionEngine.kt",
        "SuggestionStripView.kt",
        "CorrectionEngine.kt",
        "KeyAdjacency.kt",
        "UserLexicon.kt",
        // Ships unconditionally: degrades to "model unavailable" when the
        // libechoslm.so native module isn't in the build (see below).
        "LmReranker.kt",
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

      // LM reranker native module (context-aware autocorrect): staged only
      // when the llama.cpp static libs were built locally
      // (scripts/keyboard-lm/build-llama-android.sh). The CMake project
      // compiles a stub for ABIs without vendor libs, and without the module
      // at all LmReranker.kt degrades at runtime, so nothing else is
      // conditional.
      if (lmEnabled()) {
        const cppDir = path.join(androidRoot, "cpp", "keyboard-lm");
        // Wiped rather than merged: this directory doubles as RN's app CMake
        // dir, which globs `*.cpp` next to CMakeLists.txt and swaps RN's own
        // OnLoad.cpp for whatever it finds. A source left behind by an earlier
        // layout would silently drop OnLoad.cpp from libappmodules.so.
        fs.rmSync(cppDir, { recursive: true, force: true });
        const echosLmDir = path.join(cppDir, "echoslm");
        ensureDir(echosLmDir);
        fs.copyFileSync(
          path.join(TEMPLATES_DIR, "cpp", "CMakeLists.txt"),
          path.join(cppDir, "CMakeLists.txt"),
        );
        for (const file of ["llama_jni.cpp", "CMakeLists.txt"]) {
          fs.copyFileSync(
            path.join(TEMPLATES_DIR, "cpp", "echoslm", file),
            path.join(echosLmDir, file),
          );
        }
        fs.cpSync(LM_VENDOR_DIR, path.join(echosLmDir, "vendor"), {
          recursive: true,
        });
      }

      // Bundle the compiled correction dictionary (committed artifact — see
      // scripts/keyboard-dictionary/build.js) into assets/; CorrectionEngine
      // reads it via an InputStream, so AAPT compression is irrelevant.
      const assetsDir = path.join(androidRoot, "assets");
      ensureDir(assetsDir);
      fs.copyFileSync(
        path.join(
          projectRoot,
          "data",
          "keyboard-dictionary",
          "keyboard_dictionary.echd",
        ),
        path.join(assetsDir, "keyboard_dictionary.echd"),
      );

      // Bundle the confusables table (ill -> I'll etc.); CorrectionEngine
      // parses it at load for context-aware confusable correction.
      fs.copyFileSync(
        path.join(
          projectRoot,
          "data",
          "keyboard-dictionary",
          "confusables.json",
        ),
        path.join(assetsDir, "confusables.json"),
      );

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

      // res/values-land/keyboard_dimens.xml — landscape overrides
      // (shorter keys, vertical gap == horizontal gap).
      const valuesLandDir = path.join(resDir, "values-land");
      ensureDir(valuesLandDir);
      const dimensLandPath = path.join(
        TEMPLATES_DIR,
        "res",
        "values-land",
        "keyboard_dimens.xml",
      );
      if (fs.existsSync(dimensLandPath)) {
        fs.writeFileSync(
          path.join(valuesLandDir, "keyboard_dimens.xml"),
          fs.readFileSync(dimensLandPath, "utf8"),
        );
      }

      // JVM parity suite (templates/test/) + the fixtures it replays: proves
      // CorrectionEngine.kt matches decoder.js. Run via
      // `./gradlew :app:testDebugUnitTest`.
      const testJavaDir = path.join(
        projectRoot,
        "android",
        "app",
        "src",
        "test",
        "java",
        "com",
        "a1lab",
        "echos",
        "ime",
      );
      ensureDir(testJavaDir);
      // No existsSync guard: a missing parity suite must fail prebuild loudly
      // rather than silently ship without it.
      const testSource = path.join(
        TEMPLATES_DIR,
        "test",
        "CorrectionEngineParityTest.kt",
      );
      fs.writeFileSync(
        path.join(testJavaDir, "CorrectionEngineParityTest.kt"),
        fs.readFileSync(testSource, "utf8"),
      );
      // The dictionary/confusables/fixtures are NOT copied here — the test
      // sourceSet points straight at data/keyboard-dictionary (see
      // withImeTestDeps), so the suite always replays the bytes the repo
      // currently has instead of whatever a previous prebuild happened to
      // stage. Avoids a second 2.8 MB copy in the generated tree, and the
      // staleness where `npm run build:dictionary` and the parity run disagree.
      //
      // Earlier versions of this plugin did stage them. On a non-clean prebuild
      // those stale copies would still be on the test resource path and shadow
      // the real data, so drop them.
      const legacyTestResources = path.join(
        projectRoot,
        "android",
        "app",
        "src",
        "test",
        "resources",
      );
      for (const file of [
        "keyboard_dictionary.echd",
        "confusables.json",
        "parity-fixtures.json",
      ]) {
        const stale = path.join(legacyTestResources, file);
        if (fs.existsSync(stale)) fs.rmSync(stale);
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
  // Escape `\${...}` so JS template-literal interpolation doesn't eat the
  // Groovy `${rootProject.projectDir}` reference.
  return appendAppGradleBlock(
    config,
    "// Echos IME — expose sherpa-onnx Kotlin API to app sources",
    `dependencies {
    implementation fileTree(
        dir: "\${rootProject.projectDir}/../node_modules/react-native-sherpa-onnx/android/build/sherpa-onnx-classes",
        include: ["*.jar"],
    ).builtBy(":react-native-sherpa-onnx:extractSherpaOnnxClasses")
}`,
    "sherpa-onnx classes",
  );
}

/**
 * Test-only wiring for the correction-engine parity suite
 * (src/test/java/com/a1lab/echos/ime/CorrectionEngineParityTest.kt): JUnit 4
 * and the real org.json (android.jar only ships throwing stubs to JVM unit
 * tests). Neither ships in the app.
 *
 * The suite's fixtures are read straight out of data/keyboard-dictionary
 * rather than copied into the generated tree, so it can never replay a stale
 * dictionary against fresh fixtures (or vice versa).
 */
function withImeTestDeps(config) {
  return appendAppGradleBlock(
    config,
    // Marker describes the block's current contents: changing it re-injects on
    // an incremental prebuild instead of leaving an older block in place.
    "// Echos IME — correction-engine parity suite: deps + fixture sourceSet",
    `dependencies {
    testImplementation "junit:junit:4.13.2"
    testImplementation "org.json:json:20240303"
}
android {
    sourceSets {
        test {
            resources.srcDirs += ["\${rootProject.projectDir}/../data/keyboard-dictionary"]
        }
    }
}`,
    "parity-test deps",
  );
}

/**
 * Appends a marker-guarded Groovy block to the app build.gradle, once. The
 * marker makes it idempotent across repeated prebuilds.
 */
function appendAppGradleBlock(config, marker, body, what) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      console.warn(
        `withAndroidIme: app build.gradle is not Groovy; skipping ${what} injection.`,
      );
      return config;
    }
    if (config.modResults.contents.includes(marker)) {
      return config;
    }
    config.modResults.contents =
      config.modResults.contents.trimEnd() + `\n${marker}\n${body}\n`;
    return config;
  });
}

/**
 * Wires the keyboard-lm CMake project (libechoslm.so JNI bridge) into the
 * app build — only when the vendor static libs exist locally.
 */
function withImeLmNativeBuild(config) {
  if (!lmEnabled()) return config;
  return appendAppGradleBlock(
    config,
    "// Echos IME — keyboard LM reranker native module (llama.cpp JNI)",
    `android {
    externalNativeBuild {
        cmake {
            path "src/main/cpp/keyboard-lm/CMakeLists.txt"
        }
    }
}`,
    "keyboard-lm native build",
  );
}

/**
 * Composes Android IME manifest registration and source file generation.
 */
function withAndroidIme(config) {
  config = withImeManifest(config);
  config = withImeSources(config);
  config = withImeGradleDeps(config);
  config = withImeTestDeps(config);
  config = withImeLmNativeBuild(config);
  return config;
}

module.exports = { withAndroidIme };
