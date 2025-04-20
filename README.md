# Transcription App

A Flutter-based mobile application that performs offline speech-to-text transcription using Vosk. The app provides a simple, chat-like interface for users to record, view, and manage transcriptions.

## Features

- Record audio with a simple tap
- Selectable transcription model: Vosk (real-time streaming) or Whisper (post-recording, higher accuracy)
- Encrypts transcription data at rest on device for privacy
- Live (streaming) transcription while recording
- Offline transcription via embedded Vosk model (no internet required)
- Offline post-recording transcription via embedded Whisper model (no internet required)
- Transcriptions displayed as chat-style bubbles
- Automatic paragraph splitting by punctuation or word count
- Long-press to copy individual paragraphs
- Swipe to delete individual paragraphs
- Copy all transcriptions at once
- Clear all transcriptions
- Organize transcriptions into named sessions with a hideable sidebar (create, rename, delete, switch sessions)

## Requirements

- Flutter SDK
- Android device or emulator
- Embedded Vosk model (`assets/models/vosk-model-small-en-us-0.15.zip`)
- Embedded Whisper model (`assets/models/whisper-base-en.zip`) for offline transcription

## Getting Started

1. Clone this repository
2. Run `flutter pub get` to install dependencies
3. Ensure the Vosk model ZIP (`assets/models/vosk-model-small-en-us-0.15.zip`) is present under `assets/models/`
4. Connect an Android device or start an emulator
5. Run the app with `flutter run`

## Usage

1. In Settings, choose between Vosk (real-time streaming) or Whisper (post-recording accuracy)
2. Tap the microphone button to start recording
3. Speak clearly into your device's microphone (live transcription appears as you speak)
4. Pause or keep speaking; transcription will continue accumulating until you press stop
5. Tap the stop button to end and save the transcription as a chat bubble
6. Swipe left on any paragraph to delete it, or long-press to copy
7. Use the app bar buttons to copy all transcriptions or clear them
8. Open the sidebar (tap the menu icon or swipe from the left) to create, rename, delete, and switch between transcription sessions
