# Technical Context

## Flutter Framework
- SDK version: ^3.7.2
- Using Material 3 design system
- Multi-provider setup for state management

## Dependencies
- **UI/State Management**:
  - provider: ^6.0.5 (State management)
  - cupertino_icons: ^1.0.8 (iOS style icons)

- **Audio Handling**:
  - record: ^6.0.0 (Audio recording)

- **Transcription**:
  - vosk_flutter: ^0.3.48 (Vosk speech recognition)
  - whisper_flutter_new: ^1.0.1 (Whisper model integration)

- **Storage/File Management**:
  - path_provider: ^2.1.1 (File path management)
  - flutter_secure_storage: ^9.2.4 (Secure storage)
  - shared_preferences: ^2.2.3 (Preferences storage)
  - file_picker: ^10.1.2 (File operations)
  - path: ^1.8.3 (Path manipulation)

- **Security/Permissions**:
  - encrypt: ^5.0.3 (Data encryption)
  - permission_handler: ^12.0.0+1 (Permission management)

- **Utilities**:
  - uuid: ^4.1.0 (UUID generation)
  - intl: ^0.20.2 (Date formatting)

## Project Structure
The application follows a layered architecture with:
- UI Layer (screens, widgets)
- State Management Layer (providers)
- Business Logic Layer (managers, services)
- Data Layer (repositories, models)

## Important Technical Requirements
- Local transcription capabilities (no cloud dependency)
- Audio recording and file management
- Permission handling for microphone and storage access 