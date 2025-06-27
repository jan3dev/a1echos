# SYSTEM PATTERNS

## Architecture Overview
**Pattern:** Layered Architecture with Provider State Management  
**Platform:** Flutter (Dart)  
**Paradigm:** Mobile-first, Offline-capable  

## Design Patterns

### State Management Pattern
- **Primary:** Provider Pattern
- **Implementation:** ChangeNotifier-based providers
- **Benefits:** Reactive UI updates, clean separation of concerns
- **Key Providers:**
  - `SessionProvider` - Session lifecycle management
  - `TranscriptionStateManager` - Transcription state coordination
  - `SettingsProvider` - User preferences and configuration

### Service Layer Pattern
- **Audio Processing:** Service abstraction for different engines
- **Storage:** Encrypted storage service for data persistence
- **Transcription:** Multiple service implementations (Vosk, Whisper)

### Repository Pattern
- **TranscriptionRepository** - Data access abstraction
- **Encapsulation:** Database operations and data transformation
- **Abstraction:** Clean interface for data operations

## Data Flow Patterns

### Audio Processing Pipeline
```
Audio Input → AudioService → TranscriptionService → TranscriptionProvider → UI Update
```

### State Synchronization
```
User Action → Controller → Provider → Repository → Storage → State Update → UI Refresh
```

### Session Management Flow
```
Session Creation → SessionProvider → SessionRecordingController → AudioService → TranscriptionOrchestrator
```

## Component Architecture

### Screen Layer
- `HomeScreen` - Main navigation and session overview
- `SessionScreen` - Active recording and transcription view
- `SettingsScreen` - Configuration management

### Widget Layer
- **Stateful Widgets:** Recording controls, live transcription display
- **Stateless Widgets:** Session list items, status displays
- **Custom Widgets:** Audio visualization, transcription formatting

### Service Layer
- **AudioService** - Platform-specific audio recording
- **VoskService** - Offline transcription processing
- **WhisperService** - AI-powered transcription
- **StorageService** - Encrypted data persistence
- **EncryptionService** - Data security layer

## Data Patterns

### Model Structure
- **Session** - Recording session entity
- **Transcription** - Text output entity with metadata
- **ModelType** - Enumeration for transcription engines

### Storage Pattern
- **Encrypted Local Storage** - All data stored locally with encryption
- **JSON Serialization** - Model serialization for persistence
- **Migration Support** - Version-aware data handling

## Integration Patterns

### Multi-Service Transcription
- **Strategy Pattern** - Multiple transcription engine support
- **Factory Pattern** - Service instantiation based on configuration
- **Observer Pattern** - Real-time transcription updates

### Cross-Platform Support
- **Platform Channels** - Native functionality integration
- **Conditional Compilation** - Platform-specific implementations
- **Unified API** - Single interface across platforms

## Error Handling Patterns
- **Exception Hierarchy** - Structured error types
- **Graceful Degradation** - Fallback mechanisms
- **User Feedback** - Error state communication

## Security Patterns
- **Encryption at Rest** - All stored data encrypted
- **Local Processing** - Privacy-first approach
- **Minimal External Dependencies** - Reduced attack surface 