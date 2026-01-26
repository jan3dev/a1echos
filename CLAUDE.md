# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Echos is a React Native voice notes app with on-device transcription built using Expo. It records audio and transcribes it locally using Whisper models with VAD (Voice Activity Detection), supporting both real-time streaming transcription and file-based transcription modes.

## Development Commands

### Setup & Running
```bash
npm install           # Install dependencies
npm start             # Start Expo dev server
npm run ios           # Run iOS development build (recommended)
npm run android       # Run Android development build (recommended)
```

**Important**: This app uses native modules and **requires a development build**. Standard Expo Go will not work.

### Storybook
```bash
EXPO_PUBLIC_STORYBOOK_ENABLED=true npm start
```

### Linting
```bash
npm run lint          # Run ESLint
```

### Testing
- No test command is configured yet in package.json

## Architecture

### Core Technology Stack
- **Framework**: Expo SDK 54 + React Native 0.81.5 + React 19.1.0
- **Navigation**: expo-router (file-based routing)
- **State Management**: Zustand
- **Localization**: i18next + react-i18next
- **Audio**: expo-audio + @fugood/react-native-audio-pcm-stream
- **Transcription**: whisper.rn (on-device Whisper inference)
- **Storage**: expo-file-system + expo-secure-store + react-native-fs
- **Encryption**: expo-crypto + react-native-aes-gcm-crypto

### Path Aliases
The project uses TypeScript path aliases (configured in tsconfig.json):
```typescript
@/*                    // Root
@/components/*         // UI components
@/services/*           // Business logic services
@/stores/*             // Zustand stores
@/models/*             // TypeScript types/interfaces
@/assets/*             // Static assets
@/utils/*              // Utility functions
@/constants/*          // App constants
@/theme/*              // Theme system
@/hooks/*              // React hooks
@/localization/*       // i18n translations
```

### Directory Structure

#### `/app` - Expo Router Pages
- `(pages)/` - Main app screens (home, session detail)
- `(storybook)/` - Storybook UI dev environment
- `_layout.tsx` - Root layout with app initialization, theme, global components

#### `/components` - Three-tier Component Architecture
1. **`domain/`** - Feature-specific components (home, session, settings, transcription)
2. **`shared/`** - Cross-feature reusable components (error-view, list-item, recording-controls)
3. **`ui/`** - Primitive UI components (button, checkbox, modal, text, icon, etc.)

#### `/services` - Core Business Logic
All services follow singleton pattern and are exported from `services/index.ts`:

- **AudioService** - Audio recording lifecycle (expo-audio + PCM streaming for Android)
- **AudioSessionService** - iOS AVAudioSession configuration management
- **WhisperService** - Whisper model initialization, real-time transcription, file transcription
- **BackgroundRecordingService** - Android foreground service for background recording
- **StorageService** - Session/transcription CRUD with encrypted file storage
- **EncryptionService** - AES-GCM encryption for audio files
- **PermissionService** - Audio recording permission management
- **ShareService** - System share sheet integration

#### `/stores` - Zustand State Management
Four main stores (all exported from `stores/index.ts`):

1. **sessionStore** - Session CRUD, active session tracking, incognito mode
2. **transcriptionStore** - Recording state machine, transcription CRUD, Whisper coordination
3. **settingsStore** - User preferences (theme, language, model type, incognito mode)
4. **uiStore** - UI state (tooltips, toasts, selection modes, recording controls visibility)

**Critical**: Stores have initialization functions that must be called in order:
```typescript
await initializeSettingsStore();
await initializeSessionStore();
await initializeTranscriptionStore(); // Depends on sessionStore
```

#### `/models` - TypeScript Types
Domain models with JSON serialization helpers:
- **Session** - Recording session with metadata
- **Transcription** - Audio + transcript with timing
- **TranscriptionState** - State machine states (IDLE, RECORDING, TRANSCRIBING, etc.)
- **AppTheme** - Theme enum (LIGHT, DARK, SYSTEM)
- **ModelType** - Whisper model variants

#### `/theme` - Design System
- **themeColors.ts** - Light/dark theme color tokens
- **typography.ts** - Font definitions (Manrope, PublicSans)
- **shadows.ts** - iOS/Android platform-specific shadows
- **useTheme.ts** - Theme context hook
- **useThemeStore.ts** - Theme preference persistence

#### `/utils` - Utility Functions
- **log.ts** - Feature-flag based logging (react-native-logs)
- **TranscriptionFormatter.ts** - Text post-processing
- **WavWriter.ts** - PCM-to-WAV streaming writer
- Date/time formatting utilities

#### `/hooks` - React Hooks
- **useBackgroundRecording** - Handles background/foreground audio transitions
- **useLocalization** - i18n helpers and language switching
- **usePermissions** - Audio permission state management
- **useSessionOperations** - Session CRUD operations

#### `/localization` - i18next
- Language files in `localization/[lang]/common.json`
- Currently only English (`en`) is implemented
- Device locale detection with fallback

### Key Architectural Patterns

#### State Machine: TranscriptionStore
The transcription store implements a strict state machine for recording lifecycle:
```
IDLE → RECORDING_STARTING → RECORDING → RECORDING_STOPPING →
TRANSCRIBING → TRANSCRIPTION_COMPLETE → IDLE
```

**Critical transitions:**
- `RECORDING` can stream partial transcripts in real-time mode
- `TRANSCRIBING` is for file-mode transcription after recording stops
- Error states transition back to `IDLE` with error message

#### Service Coordination
Recording flow requires careful service coordination:
1. **Permission** check (PermissionService)
2. **Audio session** configuration (AudioSessionService on iOS)
3. **Whisper** initialization (WhisperService)
4. **Audio recording** start (AudioService)
5. **Real-time transcription** or file transcription (WhisperService)
6. **Storage** save (StorageService with encryption)

#### Whisper Model Management
- Models stored in `assets/models/whisper/`
- Default: `ggml-tiny.bin` (Whisper tiny model)
- VAD model: `ggml-silero-v6.2.0.bin`
- Models loaded into native context on first use
- iOS uses 2 threads for inference, 1 for VAD

#### Platform-Specific Recording
- **iOS**: Uses expo-audio AudioRecorder with LPCM format
- **Android**: Uses @fugood/react-native-audio-pcm-stream for PCM streaming, requires foreground service for background recording
- Audio format: 16kHz, mono, 16-bit PCM

#### Global UI Components (in _layout.tsx)
Three global overlays rendered at root:
1. **GlobalRecordingControls** - Floating recording button (visible on home/session screens)
2. **GlobalTooltipRenderer** - App-wide toast/tooltip notifications
3. **BackgroundRecordingHandler** - Manages background audio session

#### Incognito Mode
When enabled:
- Creates special session with `isIncognito: true`
- Audio and transcripts not saved to storage
- Session cleared on app close or mode toggle

#### Error Handling
- Global error handler installed in _layout.tsx
- All errors logged with FeatureFlag context
- React error boundary (AppErrorBoundary) wraps root
- Services use try/catch with logError utility

### Storage Layer

#### File Structure
```
DocumentDirectory/
  ├── sessions.json              # Session metadata
  ├── sessions/
  │   ├── [sessionId]/
  │   │   ├── transcriptions.json
  │   │   ├── audio/
  │   │   │   ├── [id].wav      # Encrypted audio files
```

#### Encryption
- Audio files encrypted with AES-GCM
- Encryption keys generated per-session using expo-crypto
- Keys stored in expo-secure-store (iOS Keychain / Android Keystore)
- File format: `[16-byte IV][encrypted PCM data]`

### Development Notes

#### Storybook Integration
- Storybook is conditionally loaded via route in _layout.tsx
- Use `EXPO_PUBLIC_STORYBOOK_ENABLED=true` to enable
- Stories defined in `.rnstorybook/` directory
- `npm run storybook-generate` generates story index

#### Native Modules
Key native dependencies requiring development builds:
- whisper.rn (Whisper inference)
- @fugood/react-native-audio-pcm-stream (Android PCM)
- @shopify/react-native-skia (graphics)
- react-native-reanimated (animations)
- @supersami/rn-foreground-service (Android background recording)

#### Background Recording
- **iOS**: Uses `UIBackgroundModes: ["audio"]` in Info.plist
- **Android**: Requires foreground service with FOREGROUND_SERVICE_MICROPHONE permission
- Foreground service registered in `plugins/withRnForegroundService`

#### iOS Audio Session
- Must configure AVAudioSession before recording
- AudioSessionService ensures proper category/mode for recording
- Handles interruptions and route changes

#### Configuration Files
- **app.json** - Expo configuration, platform settings, plugins
- **metro.config.js** - Metro bundler config with SVG transformer
- **eslint.config.js** - ESLint with expo preset
- **tsconfig.json** - TypeScript with strict mode + path aliases

### Testing Strategy

When writing tests:
- Focus on service logic (WhisperService, AudioService, StorageService)
- Test state machine transitions in transcriptionStore
- Mock native modules (whisper.rn, expo-audio, expo-file-system)
- Use React Native Testing Library for component tests

### Common Gotchas

1. **Whisper initialization is async** - Must call `whisperService.initialize()` before use
2. **Audio permissions** - Always check before starting recording
3. **iOS audio session** - Configure before starting AudioRecorder
4. **Android background** - Foreground service must be running for background recording
5. **Store initialization order** - Settings → Session → Transcription
6. **Path aliases** - VSCode/IDE may need TypeScript workspace configuration
7. **Model files** - Large binary files in assets/, ensure they're not gitignored
8. **Real-time transcription** - Requires VAD model and specific audio format
9. **Encryption keys** - Stored in secure storage, lost keys mean unrecoverable audio
10. **State machine** - Only specific state transitions are valid, enforce in transitionTo()
