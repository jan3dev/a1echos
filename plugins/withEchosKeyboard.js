const {
  withIosKeyboardExtension,
} = require("./keyboard/ios/withIosKeyboardExtension");
const {
  withIosTranscriptionListener,
} = require("./keyboard/ios/withIosTranscriptionListener");
const { withAndroidIme } = require("./keyboard/android/withAndroidIme");

/**
 * Expo config plugin that adds a system keyboard extension to both platforms.
 *
 * iOS:  Custom Keyboard Extension (App Extension target) with App Group IPC
 *       to the main app for sherpa-onnx transcription. The extension records
 *       audio and hands it off; the main app's listener (SherpaBridge) runs
 *       the offline recognizer.
 * Android: InputMethodService that calls sherpa-onnx directly via the
 *       `com.k2fsa.sherpa.onnx` JNI wrappers bundled with react-native-sherpa-onnx
 *       (same process as the main app).
 *
 * All native source files live as templates in plugins/keyboard/ and are written
 * to the generated ios/ and android/ directories during expo prebuild.
 */
const withEchosKeyboard = (config) => {
  // iOS: Add keyboard extension target + App Group + transcription listener
  config = withIosKeyboardExtension(config);
  config = withIosTranscriptionListener(config);

  // Android: Register InputMethodService + write Kotlin sources & resources
  config = withAndroidIme(config);

  return config;
};

module.exports = withEchosKeyboard;
