# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a **transcription app** built with **Flutter**, designed for **Android and iOS** with features for session recording, transcription services (via Vosk and Whisper), and model management. The app supports real-time audio transcription, session management, and mobile-first UI/UX.

## Key Technologies

- **Flutter** 3.x (Dart) - Cross-platform mobile development
- **Android & iOS** native integrations
- **Transcription Models**:
  - **Vosk** (offline, on-device)
  - **Whisper** (via Flutter integration)
- **Audio Processing** - Native iOS/Android audio permissions + Flutter plugins
- **State Management** - Provider pattern with Model + Repository pattern
- **Theming** - Light/Dark mode with Material 3 design

## Getting Started

### Prerequisites

- Flutter SDK 3.x
- Dart SDK
- Android Studio / Xcode installed
- Vosk model downloaded (see setup)

### Build & Test

```bash
# Install dependencies
flutter pub get

# Run the app
flutter run

# Build APK
flutter build apk

# Build for iOS
flutter run ios
```

### Tests
```bash
# Run all tests
flutter test ./test

# Run specific test
flutter test test/widget_test.dart
```

### Linting
```bash
flutter analyze
```

## Key Directories

```
lib/
├── main.dart               # App entry point
├── screens/              # UI Screens (Home, Settings, etc.)
├── providers/            # State management (Provider pattern)
├── services/             # API services (Vosk, Whisper, Audio)
├── models/               # Data models (Transcription, Session)
├── widgets/              # UI components
├── managers/             # Business logic orchestration
└── repositories/         # Data layer (TranscriptionRepository)
```

## Architecture

- **State Management**: Provider pattern with Repository + Service layers
- **Services**: Modular services for transcription (Vosk, Whisper), audio, and storage
- **Models**: Clean domain models with JSON serialization
- **UI**: Reactive components with Material 3 theming

## Development Environment

- **Flutter**: Cross-platform mobile development framework
- **JVM**: Kotlin/Swift for native integrations
- **IDE**: VS Code or Android Studio recommended
- **Testing**: Unit tests via `flutter test`

## Notes

- The app requires Vosk models for offline transcription (large files ~150MB)
- Supports both local (Vosk) and cloud (Whisper) transcription modes
- Includes localization via Crowdin
- Uses secure storage for sensitive data