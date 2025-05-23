# Technical Context

## Development Framework
- **Flutter SDK**: ^3.7.2 for cross-platform mobile development
- **Dart Language**: Version compatible with Flutter SDK requirements

## State Management
- **Provider Pattern**: Primary state management solution (provider: ^6.0.5)
- **SharedPreferences**: Persistent storage for app settings and user preferences
- **StreamController**: Used for real-time transcription updates and event broadcasting

## Audio Processing
- **Record Package**: ^6.0.0 for audio recording functionality
- **Permission Handler**: ^12.0.0+1 for audio recording permissions
- **Path Provider**: ^2.1.1 for accessing device storage paths

## Transcription Engines
- **Vosk Flutter**: ^0.3.48 for real-time speech recognition
  - Provides streaming transcription with partial results
  - Operates during recording phase
  - No audio file persistence required
- **Whisper Flutter New**: ^1.0.1 for high-accuracy post-processing transcription
  - Processes complete audio files after recording
  - Requires audio file storage for processing
  - Higher accuracy but delayed results

## Storage and Security
- **Flutter Secure Storage**: ^9.2.4 for sensitive data storage
- **Encrypt**: ^5.0.3 for data encryption capabilities
- **Path**: ^1.8.3 for file path manipulation
- **File Picker**: ^10.1.2 for file selection operations

## UI Framework
- **Material Design 3**: Primary design system
- **Flutter SVG**: ^2.0.7 for scalable vector graphics
- **Custom UI Components**: External design system from aqua-design-system repository
- **Custom Fonts**: 
  - Inter family (Regular, Medium, SemiBold)
  - RobotoMono family (Regular, Medium, SemiBold)

## Utility Libraries
- **UUID**: ^4.1.0 for unique identifier generation
- **Intl**: ^0.20.2 for internationalization and date formatting
- **Cupertino Icons**: ^1.0.8 for iOS-style icons

## Architecture Patterns
- **Provider Architecture**: Centralized state management with LocalTranscriptionProvider and SessionProvider
- **Service Layer Pattern**: Dedicated services for specific functionality (AudioService, VoskService, WhisperService, StorageService, EncryptionService)
- **Repository Pattern**: Data access abstraction for transcriptions and sessions
- **Orchestration Pattern**: TranscriptionOrchestrator coordinates complex workflows
- **Manager Pattern**: SessionTranscriptionManager handles session-specific filtering

## Development Tools
- **Flutter Test**: Built-in testing framework
- **Flutter Lints**: ^5.0.0 for code quality and consistency
- **Flutter Launcher Icons**: ^0.14.3 for app icon generation

## Platform Compatibility
- **iOS**: Full support with native audio permissions
- **Android**: Full support with audio recording permissions
- **Cross-platform**: Single codebase for both platforms using Flutter

## Data Models
- **Session Model**: User-created organizational units for transcriptions
- **Transcription Model**: Individual transcription records with metadata
- **ModelType Enum**: Vosk vs Whisper model selection
- **TranscriptionOutput**: Structured transcription results with audio file references

## External Dependencies
- **Git-based UI Components**: aqua-design-system for consistent UI components
- **Local Model Assets**: Stored in assets/models/ directory for offline transcription

## Performance Considerations
- **Local Processing**: All transcription occurs on-device for privacy
- **Memory Management**: Stream-based processing for real-time transcription
- **File Management**: Efficient audio file handling with cleanup for Whisper workflows
- **State Optimization**: Comprehensive state management to prevent unnecessary rebuilds

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