# TECHNICAL CONTEXT

## Technology Stack

### Core Framework
- **Flutter** - Cross-platform mobile framework
- **Dart** - Primary programming language
- **Version:** Based on project structure, likely Flutter 3.x+

### State Management
- **Provider** - Official Flutter state management solution
- **ChangeNotifier** - Reactive state pattern
- **Consumer/Selector** - Granular UI updates

### Audio Processing
- **Native Audio Recording** - Platform-specific audio capture
- **Vosk** - Offline speech recognition engine
- **Whisper** - OpenAI speech-to-text model
- **Audio Format:** Standard mobile formats (AAC, WAV)

### Storage & Persistence
- **Local Storage** - Device-based data persistence
- **Encryption** - AES encryption for sensitive data
- **JSON Serialization** - Data format for model persistence
- **Flutter Secure Storage** - Secure key-value storage

### Platform Integration
- **Android** - Kotlin/Java native integration
- **iOS** - Swift/Objective-C native integration
- **Platform Channels** - Flutter-native communication

## Development Environment

### Build System
- **Gradle** - Android build system (Kotlin DSL)
- **Xcode** - iOS build system
- **Flutter SDK** - Cross-platform toolchain

### Dependencies
- **Core Flutter Dependencies:**
  - `provider` - State management
  - `flutter_secure_storage` - Secure storage
  - `path_provider` - File system access
  - Native platform integrations

### Testing
- **Widget Tests** - Flutter UI testing
- **Unit Tests** - Business logic testing
- **Integration Tests** - End-to-end testing capabilities

## Architecture Implementation

### Project Structure
```
lib/
├── constants/       # App-wide constants
├── controllers/     # Business logic controllers
├── main.dart       # App entry point
├── managers/       # High-level coordination
├── models/         # Data models
├── providers/      # State management
├── repositories/   # Data access layer
├── screens/        # UI screens
├── services/       # External service integration
├── utils/          # Utility functions
└── widgets/        # Reusable components
```

### Service Integration
- **VoskService** - Local speech recognition
- **WhisperService** - Cloud-based transcription
- **AudioService** - Audio recording and playback
- **StorageService** - Data persistence
- **EncryptionService** - Security layer

### Data Models
- **Session** - Recording session representation
- **Transcription** - Text output with metadata
- **ModelType** - Transcription engine enumeration

## Platform-Specific Features

### Android
- **Permissions** - Microphone, storage access
- **Background Processing** - Service-based audio recording
- **File System** - Android-specific storage paths
- **Build Configuration** - Gradle build scripts

### iOS
- **Permissions** - Privacy-focused permission handling
- **Background Audio** - iOS audio session management
- **File System** - iOS sandbox-compliant storage
- **Build Configuration** - Xcode project settings

## Performance Considerations

### Audio Processing
- **Real-time Processing** - Low-latency transcription
- **Memory Management** - Efficient audio buffer handling
- **Battery Optimization** - Power-efficient recording

### Data Management
- **Lazy Loading** - On-demand data loading
- **Caching** - Strategic data caching
- **Compression** - Efficient storage utilization

### UI Performance
- **Widget Optimization** - Efficient widget rebuilding
- **State Isolation** - Minimal state propagation
- **Smooth Animations** - 60fps target performance

## Security Implementation

### Data Protection
- **Encryption at Rest** - All stored data encrypted
- **Local Processing** - Privacy-first approach
- **Secure Storage** - Protected key-value storage
- **No Cloud Dependencies** - Optional cloud features

### Code Security
- **Obfuscation** - Release build code protection
- **Certificate Pinning** - Network security (if applicable)
- **Secure Communication** - HTTPS for external services

## Development Tools

### IDE Support
- **VS Code** - Flutter development environment
- **Android Studio** - Android-specific development
- **Xcode** - iOS development and testing

### Debugging
- **Flutter Inspector** - Widget tree inspection
- **Platform Debugging** - Native debugging tools
- **Logging** - Structured logging implementation

### Performance Monitoring
- **Flutter Performance** - Frame rate monitoring
- **Memory Profiling** - Memory usage analysis
- **CPU Profiling** - Performance bottleneck identification 