## Echos

On-device voice notes + transcription built with Expo / React Native.

### What it does

- **Record + transcribe**: real-time transcription (Whisper + VAD) and file transcription modes
- **On-device storage**: sessions + transcripts stored locally (encrypted at rest)
- **Settings**: theme, language, incognito mode

### Quickstart

```bash
npm install
npm start
```

This app uses native modules; a **development build** is recommended (and may be required):

```bash
npm run ios
# or
npm run android
```

### Storybook

```bash
EXPO_PUBLIC_STORYBOOK_ENABLED=true npm start
```

### Models

Whisper model binaries live in `assets/models/whisper/` and are loaded on-device.
