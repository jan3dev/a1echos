# Transcription App

A Flutter-based mobile application that transcribes audio to text using OpenAI's transcriptions API. The app provides a simple, chat-like interface for users to record, view, and manage transcriptions.

## Features

- Record audio with a simple tap
- Automatically transcribe speech to text using OpenAI's Whisper API
- View transcriptions in a chat-like interface
- Copy individual transcriptions
- Swipe to delete individual transcriptions
- Copy all transcriptions at once
- Clear all transcriptions
- Securely store your OpenAI API key

## Requirements

- Flutter SDK
- Android device or emulator
- OpenAI API key

## Getting Started

1. Clone this repository
2. Run `flutter pub get` to install dependencies
3. Connect an Android device or start an emulator
4. Run the app with `flutter run`
5. On first launch, you'll need to add your OpenAI API key in Settings

## Setting Up Your OpenAI API Key

1. Visit [OpenAI API Keys](https://platform.openai.com/api-keys) to create an API key
2. In the app, go to Settings (gear icon in the app bar)
3. Enter your API key and tap "Save API Key"
4. Your key is now securely stored on your device

## Usage

1. With your API key set up, tap the microphone button to start recording
2. Speak clearly into your device's microphone
3. Tap the stop button when you're done
4. The app will automatically transcribe your speech
5. View all your transcriptions in the main screen
6. Swipe left on a transcription to delete it
7. Tap the copy icon to copy a specific transcription
8. Use the app bar buttons to copy all transcriptions or clear them
