# Echos

<p>
  <a href="https://github.com/jan3dev/a1echos?tab=MIT-1-ov-file"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License: MIT"></a>
  <a href="https://a1lab.com/"><img src="https://img.shields.io/badge/Built%20by-A1%20Lab-black?style=for-the-badge" alt="Built by A1 Lab"></a>
</p>

On-device voice notes + transcription built with Expo / React Native.

## What it does

- **Record + transcribe**: real-time streaming and file-based transcription via [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)
- **On-device storage**: sessions + transcripts stored locally, audio encrypted at rest (AES-GCM)
- **Settings**: theme, language, ASR model, per-model language, incognito mode, and advanced options

## Quickstart

```bash
npm install
npm run fetch:whisper-model
npm start
```

The bundled Whisper Base model is gitignored. `npm run fetch:whisper-model` downloads and checksums it into `assets/models/sherpa-whisper/` (EAS builds run it via the `eas-build-pre-install` hook). To place it manually, put `base-encoder.int8.onnx`, `base-decoder.int8.onnx` and `base-tokens.txt` from [csukuangfj/sherpa-onnx-whisper-base](https://huggingface.co/csukuangfj/sherpa-onnx-whisper-base) in that folder. Tests don't need it.

This app uses native modules and **requires a development build** — Expo Go will not work:

```bash
npm run ios
# or
npm run android
```

## Design System Gallery

Longpress the Echos wordmark on the homescreen in dev mode to open the design system gallery.

## Testing

```bash
npm run test              # run all tests
npm run test:coverage     # run with coverage (thresholds: 95/90/95/95)
```

## Models

Transcription runs on-device via sherpa-onnx. Only Whisper Base is bundled; the rest are downloaded on demand from HuggingFace into `DocumentDirectory/models/`.

| Model            | Size   | Languages                | Modes           | Bundled |
| ---------------- | ------ | ------------------------ | --------------- | ------- |
| Whisper Base     | ~161MB | 99                       | realtime + file | yes     |
| Whisper Small    | ~375MB | 99                       | realtime + file | no      |
| NeMo Parakeet V3 | ~670MB | 25 European              | realtime + file | no      |
| Qwen3 ASR        | ~983MB | 30 + 22 Chinese dialects | file only       | no      |
