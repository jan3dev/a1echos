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

Transcription runs on-device via sherpa-onnx. Only Whisper Tiny is bundled; the rest are downloaded on demand from HuggingFace into `DocumentDirectory/models/`.

| Model            | Size   | Languages                | Modes           | Bundled |
| ---------------- | ------ | ------------------------ | --------------- | ------- |
| Whisper Tiny     | ~104MB | 99                       | realtime + file | yes     |
| Whisper Base     | ~161MB | 99                       | realtime + file | no      |
| Whisper Small    | ~375MB | 99                       | realtime + file | no      |
| NeMo Parakeet V3 | ~670MB | 25 European              | realtime + file | no      |
| Qwen3 ASR        | ~983MB | 30 + 22 Chinese dialects | file only       | no      |
