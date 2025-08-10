# Flutter Transcription App Code Review Command

```yaml
---
command: "/review"
category: "Quality & Code Review"
purpose: "Deep code review for Flutter transcription app with transcription-specific patterns"
wave-enabled: true
performance-profile: "complex"
---
```

## Overview

Custom deep code review command tailored for this Flutter transcription app, focusing on:
- **Audio Processing**: Recording, streaming, VAD (Voice Activity Detection) patterns
- **Transcription Models**: Vosk (offline) and Whisper integration patterns
- **Flutter Architecture**: Provider pattern, service layer, widget structure
- **Mobile Optimization**: Android/iOS specific considerations
- **Session Management**: Recording sessions, transcription persistence
- **Security**: Audio data handling, encryption, permissions

## Auto-Persona Activation
- **Primary**: `--persona-qa` - Quality assurance and testing specialist
- **Secondary**: `--persona-analyzer` - Root cause and pattern analysis
- **Supporting**: `--persona-security` - Audio data security review
- **Mobile**: `--persona-frontend` - Flutter UI/UX patterns

## MCP Integration
- **Primary**: Sequential - For systematic code analysis and quality assessment
- **Secondary**: Context7 - For Flutter/Dart best practices and patterns
- **Tertiary**: Playwright - For mobile testing recommendations

## Review Categories

### 1. Flutter Architecture Review
**Focus Areas**:
- Provider pattern implementation and state management
- Service layer separation (AudioService, VoskService, WhisperService)
- Repository pattern for data persistence
- Widget composition and reusability
- Model structure and JSON serialization

**Quality Gates**:
- ✅ Proper separation of concerns between providers, services, and repositories
- ✅ Consistent state management patterns across the app
- ✅ Proper widget lifecycle management
- ✅ Error handling in async operations
- ✅ Memory management in audio processing

### 2. Audio Processing & Transcription Review
**Focus Areas**:
- Audio recording implementation and error handling
- VAD (Voice Activity Detection) integration
- Streaming vs file-based recording patterns
- Transcription service orchestration (Vosk/Whisper)
- Audio format compatibility and fallback mechanisms

**Quality Gates**:
- ✅ Proper audio permission handling for iOS/Android
- ✅ Resource cleanup in audio services (streams, subscriptions)
- ✅ Error recovery for failed recordings/transcriptions
- ✅ Memory management for large audio files
- ✅ Performance optimization for real-time processing

### 3. Mobile Platform Integration
**Focus Areas**:
- Android/iOS specific implementations
- Permission handling consistency
- Native module integration (Vosk, Whisper models)
- Platform-specific audio optimizations
- Build configurations and dependencies

**Quality Gates**:
- ✅ Consistent permission handling across platforms
- ✅ Proper native module error handling
- ✅ Platform-specific UI adaptations
- ✅ Resource management for large model files
- ✅ Background processing considerations

### 4. Security & Privacy Review
**Focus Areas**:
- Audio data encryption and secure storage
- Session data privacy (incognito mode)
- Permission boundary validation
- Secure sharing mechanisms
- Data retention policies

**Quality Gates**:
- ✅ Audio files encrypted at rest
- ✅ Secure session management
- ✅ Proper permission request flows
- ✅ Safe sharing without data leakage
- ✅ Clear data lifecycle management

### 5. Performance & Resource Management
**Focus Areas**:
- Memory usage during recording/transcription
- Audio processing efficiency
- Model loading and caching strategies
- UI responsiveness during heavy operations
- Battery optimization

**Quality Gates**:
- ✅ Efficient memory management for audio streams
- ✅ Background processing optimization
- ✅ Model caching and lazy loading
- ✅ UI thread protection during heavy operations
- ✅ Battery usage optimization

### 6. Testing & Maintainability
**Focus Areas**:
- Unit test coverage for critical audio/transcription logic
- Widget test patterns for recording UI
- Mock implementations for transcription services
- Code documentation and inline comments
- Dart/Flutter best practices adherence

**Quality Gates**:
- ✅ Critical audio processing paths tested
- ✅ UI recording flow tested
- ✅ Service layer properly mocked
- ✅ Code documentation for complex logic
- ✅ Flutter linting rules compliance

## Review Execution

### Automatic Triggers
- Audio processing logic changes
- Transcription service modifications
- Provider state management updates
- Security-related code changes
- Platform-specific implementations

### Review Patterns

**Deep Analysis Pattern** (Primary):
```bash
/review --think-hard --focus quality,security,performance
```

**Security Focus**:
```bash
/review --persona-security --focus security --validate
```

**Performance Focus**:
```bash
/review --persona-performance --focus performance --think
```

**Architecture Review**:
```bash
/review --persona-architect --scope project --ultrathink
```

## Flutter-Specific Checks

### State Management Patterns
- Provider implementation consistency
- ChangeNotifier proper usage
- State synchronization between providers
- Memory leaks in listeners

### Widget Architecture
- Proper widget composition
- StatefulWidget vs StatelessWidget usage
- Build method optimization
- Context usage patterns

### Async Operations
- Future and Stream handling
- Error propagation in async chains
- Cancellation and cleanup
- UI state during async operations

### Platform Integration
- Platform channel implementation
- Native code integration patterns
- Asset management (models, fonts)
- Build configuration consistency

## Transcription-Specific Patterns

### Audio Processing
- Recording quality and format optimization
- Stream processing efficiency
- VAD integration effectiveness
- Audio data lifecycle management

### Model Management
- Vosk model loading and caching
- Whisper model integration
- Model switching logic
- Performance comparison patterns

### Session Management
- Recording session state consistency
- Transcription persistence patterns
- Session metadata management
- Data export/sharing flows

## Command Usage Examples

```bash
# Comprehensive review
/review

# Focus on audio processing
/review --focus performance,security lib/services/audio_service.dart

# Architecture review
/review --persona-architect --scope project

# Security audit for audio data
/review --persona-security --focus security --validate

# Performance review for transcription
/review --persona-performance lib/services/vosk_service.dart lib/services/whisper_service.dart

# Mobile platform review
/review --focus quality lib/services/native_audio_permission_service.dart android/ ios/
```

## Integration with Project Workflows

### Pre-commit Review
```bash
/review --quick --focus quality,security
```

### Release Review
```bash
/review --comprehensive --all-personas --validate
```

### Performance Review
```bash
/review --persona-performance --focus performance --benchmark
```

### Security Audit
```bash
/review --persona-security --focus security --think-hard
```

## Expected Outputs

1. **Quality Assessment Report** with scoring per category
2. **Security Analysis** with vulnerability identification
3. **Performance Recommendations** with optimization suggestions  
4. **Architecture Feedback** with pattern improvement suggestions
5. **Testing Gaps** with coverage recommendations
6. **Flutter Best Practices** compliance report
7. **Mobile Platform** specific recommendations
8. **Transcription Logic** accuracy and efficiency review

## Success Metrics

- **Code Quality Score**: ≥85% across all categories
- **Security Compliance**: 100% for audio data handling
- **Performance Targets**: <100ms UI response, <2MB memory for audio processing
- **Test Coverage**: ≥80% for critical audio/transcription paths
- **Flutter Compliance**: 100% lint rule adherence
- **Platform Consistency**: Consistent behavior across Android/iOS
- **Documentation Coverage**: ≥70% for complex audio/transcription logic