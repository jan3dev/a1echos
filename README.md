## Echos

On-device voice notes + transcription built with Expo / React Native.

### What it does

- **Record + transcribe**: real-time streaming and file-based transcription via [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)
- **On-device storage**: sessions + transcripts stored locally, audio encrypted at rest (AES-GCM)
- **Settings**: theme, language, ASR model, per-model language, incognito mode, and advanced options

### Quickstart

```bash
npm install
npm start
```

This app uses native modules and **requires a development build** — Expo Go will not work:

```bash
npm run ios
# or
npm run android
```

### Storybook

```bash
EXPO_PUBLIC_STORYBOOK_ENABLED=true npm start
```

### Testing

```bash
npm run test              # run all tests
npm run test:coverage     # run with coverage (thresholds: 95/90/95/95)
```

### Models

Transcription runs on-device via sherpa-onnx. Two models are supported:

- **Whisper Tiny** — bundled in `assets/models/sherpa-whisper/`, 99 languages, copied to cache on first use
- **NeMo Parakeet V3** — ~670MB, downloaded on demand from HuggingFace into `DocumentDirectory/models/`, 25 European languages
