# Echos

Expo React Native voice notes app with on-device transcription (sherpa-onnx: Whisper Tiny bundled, Parakeet V3 downloadable).

## Rules

- Needs a development build (`npm run ios` / `npm run android`); Expo Go won't work.
- `ios/` and `android/` are CNG output: never edit by hand. Native changes go through config plugins in `plugins/`.
- Run `npm run test:coverage` after changes; thresholds in `jest.config.js` are enforced.
- New components: co-located `*.gallery.tsx` exporting a `GalleryEntry`, registered in `DESIGN_SYSTEM_MANIFEST` (`app/(design-system)/manifest.ts`).
- Don't add dependencies unless necessary; check CVEs before installing.
- Codex will review your code.

## Keyboard dictionary

- `scripts/keyboard-dictionary/decoder.js` is the canonical engine spec; `CorrectionEngine.swift` and `CorrectionEngine.kt` mirror it 1:1. Every tuning or gate change lands in all three.
- Then re-bless golden vectors: `node scripts/keyboard-dictionary/generate-parity-fixtures.js --update`.
- Judge tuning with `npm run bench:dictionary --tune key=value` before and after, never by eye.
- Parity: `npm run test:parity:ios` (swiftc), `npm run test:parity:android` (needs prebuilt `android/` + JDK 17).

## Gotchas

- `sherpaTranscriptionService.initialize(modelId, language)` reinitializes on model/language change. Whisper language is fixed at init; Parakeet auto-detects.
- Store init order: Settings → Session → Transcription → ModelDownload.
- No FFmpeg: don't use sherpa-onnx `convertAudioToWav16k`; AudioService already records 16kHz mono 16-bit PCM WAV.
- iOS: configure AVAudioSession before starting AudioRecorder. Android: foreground service must run for background recording.
- Audio encryption keys live in secure storage; lost key = unrecoverable audio.
- Transcription state machine: enforce valid transitions in `transitionTo()`.
- `settingsStore.setModelId` resets language to English if the new model's `supportedLanguageCodes` (ModelRegistry) excludes it.
