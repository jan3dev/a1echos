/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["./jest.setup.js"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|react-native-reanimated|react-native-gesture-handler|react-native-screens|react-native-safe-area-context|@shopify/react-native-skia|react-native-aes-gcm-crypto|react-native-fs|@dr.pogodin/react-native-fs|react-native-logs|react-native-worklets|@fugood/react-native-audio-pcm-stream|@supersami/rn-foreground-service|@react-native-async-storage/async-storage|@react-native-masked-view/masked-view|@react-native-community/.*|whisper\\.rn|base64-js|zustand|immer|i18next|react-i18next)",
  ],
  moduleNameMapper: {
    "\\.svg$": "<rootDir>/__mocks__/svgMock.js",
    "\\.bin$": "<rootDir>/__mocks__/binMock.js",
    "\\.onnx$": "<rootDir>/__mocks__/binMock.js",
    "\\.(txt|wav)$": "<rootDir>/__mocks__/binMock.js",
    "^whisper\\.rn/src/realtime-transcription/adapters/AudioPcmStreamAdapter$":
      "<rootDir>/node_modules/whisper.rn/src/realtime-transcription/adapters/AudioPcmStreamAdapter",
    "^whisper\\.rn/src/realtime-transcription$":
      "<rootDir>/node_modules/whisper.rn/src/realtime-transcription/index",
    "^whisper\\.rn$": "<rootDir>/node_modules/whisper.rn/src/index",
    "^@/(.*)$": "<rootDir>/$1",
  },
  collectCoverageFrom: [
    "app/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
    "constants/**/*.{ts,tsx}",
    "hooks/**/*.{ts,tsx}",
    "models/**/*.{ts,tsx}",
    "services/**/*.{ts,tsx}",
    "stores/**/*.{ts,tsx}",
    "theme/**/*.{ts,tsx}",
    "utils/**/*.{ts,tsx}",
    "!**/*.stories.{ts,tsx}",
    "!**/*.test.{ts,tsx}",
    "!**/index.{ts,tsx}",
    "!**/__mocks__/**",
    "!**/node_modules/**",
    "!components/ui/icon/flagIcons.ts",
    "!components/shared/recording-controls/ThreeWaveLines.tsx",
    "!services/BackgroundRecordingService.ts",
    "!services/ModelDownloadService.ts",
    "!services/SherpaTranscriptionService.ts",
    "!stores/modelDownloadStore.ts",
    "!models/ModelType.ts",
    "!models/TranscriptionState.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  modulePathIgnorePatterns: ["<rootDir>/.yoyo/"],
  clearMocks: true,
};
