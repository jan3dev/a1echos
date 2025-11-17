# Services

## WhisperService

The `WhisperService` provides offline speech-to-text transcription using OpenAI's Whisper model via whisper.rn.

### Features

- **Offline Transcription**: Uses bundled tiny model (no internet required)
- **File-based Transcription**: Transcribe audio files with language selection
- **Real-time Transcription**: Live microphone transcription with partial results
- **Language Support**: Supports all Whisper languages
- **Partial Results**: Subscribe to streaming transcription updates during real-time mode
- **Cross-platform**: Works on both iOS and Android

### Usage

```typescript
import { whisperService } from './services';

// Initialize the service (loads model)
const success = await whisperService.initialize();

// Check initialization status
console.log(whisperService.isInitialized);
console.log(whisperService.initializationStatus);

// Transcribe an audio file
const text = await whisperService.transcribeFile(
  '/path/to/audio.wav',
  'en' // optional language code
);

// Start real-time transcription
const started = await whisperService.startRealtimeTranscription('en');

// Subscribe to partial results
const unsubscribe = whisperService.subscribeToPartialResults((text) => {
  console.log('Partial:', text);
});

// Stop real-time transcription
const finalText = await whisperService.stopRealtimeTranscription();

// Clean up
unsubscribe();
await whisperService.dispose();
```

### Model

- **Size**: Tiny (~75MB)
- **Location**: `assets/models/whisper/ggml-tiny.bin`
- **Format**: GGML (works on both iOS and Android)
- **Performance**: Fast inference, suitable for real-time use on mobile

### Notes

- Real-time transcription requires microphone permissions
- The current implementation uses `transcribeRealtime()` which is deprecated in whisper.rn
- For production with VAD and advanced features, consider upgrading to `RealtimeTranscriber`

---

## StorageService

The `StorageService` provides encrypted persistent storage for transcriptions and audio files.

### Features

- **Encrypted Storage**: All transcription data is encrypted using AES-GCM before being saved to disk
- **JSON-based**: Transcriptions are stored as encrypted JSON in `transcriptions.json`
- **Audio File Management**: Copy and manage audio files in a dedicated directory
- **Pending Deletes Queue**: Tracks audio files that failed to delete and retries on app startup
- **Error Recovery**: Handles corrupted files by backing them up and starting fresh

### Usage

```typescript
import { storageService } from './services';

// Get all transcriptions
const transcriptions = await storageService.getTranscriptions();

// Save a new transcription
await storageService.saveTranscription({
  id: 'unique-id',
  sessionId: 'session-id',
  text: 'Transcribed text',
  timestamp: new Date(),
  audioPath: '/path/to/audio.wav',
});

// Delete a transcription (also deletes associated audio file)
await storageService.deleteTranscription('unique-id');

// Save an audio file
const newPath = await storageService.saveAudioFile(
  '/temp/recording.wav',
  'recording-123.wav'
);

// Delete all transcriptions for a session (also deletes associated audio files)
await storageService.deleteTranscriptionsForSession('session-id');

// Clear all transcriptions (also deletes all audio files)
await storageService.clearTranscriptions();

// Process pending deletes (call on app startup)
await storageService.processPendingDeletes();
```

### File Structure

```
{documentDirectory}/
├── transcriptions.json          # Encrypted transcription data
├── pending_deletes.json         # Queue of audio files to retry deletion
└── audio/                       # Audio file storage
    ├── recording-1.wav
    ├── recording-2.wav
    └── ...
```

### Migration Notes

Converted from Flutter's `StorageService` with the following changes:

- **File Operations**: `dart:io File` → `expo-file-system`
- **Path Provider**: `path_provider` → `FileSystem.documentDirectory`
- **Locking**: Removed `synchronized` lock (JavaScript is single-threaded)
- **Encryption**: Uses the migrated `EncryptionService` with AES-GCM
- **Error Logging**: Console methods (structured logger to be added later)

### Error Handling

The service handles several error scenarios:

1. **Corrupt Transcriptions File**: Deletes the file and returns empty array
2. **Corrupt Pending Deletes**: Backs up to `.corrupted.{timestamp}` file
3. **Audio Deletion Failures**: Attempts overwrite-then-delete, queues for retry
4. **Decryption Failures**: Treats as corrupt file and recovers gracefully

### Audio File Cleanup

All deletion operations automatically clean up associated audio files:

- `deleteTranscription(id)` - Deletes the transcription record AND its audio file
- `clearTranscriptions()` - Clears all transcription records AND deletes all audio files
- `deleteTranscriptionsForSession(sessionId)` - Deletes all transcriptions for a session AND their audio files

If audio file deletion fails, the path is added to the pending deletes queue and will be retried on the next app startup.

## EncryptionService

The `EncryptionService` provides AES-GCM encryption for sensitive data.

### Usage

```typescript
import { encryptionService } from './services';

const encrypted = await encryptionService.encrypt('plaintext');
const decrypted = await encryptionService.decrypt(encrypted);
```

See `EncryptionService.ts` for implementation details.

## Audio Service

The AudioService provides audio recording functionality with background recording support for both iOS and Android platforms.

### Features

- **Audio Recording**: 16kHz WAV format recording with mono channel
- **Background Recording**: Continues recording when app is in background (iOS & Android)
- **Amplitude Monitoring**: Real-time audio level streaming for visualization
- **Monitoring Mode**: Test audio levels without saving files
- **Haptic Feedback**: Vibration feedback on recording start/stop
- **Permission Management**: Microphone permission handling
- **File Management**: Automatic file generation and cleanup

### Usage

#### Initialize Service

```typescript
import AudioService from './services/AudioService';

const audioService = AudioService.getInstance();
```

#### Check Permissions

```typescript
const hasPermission = await audioService.hasPermission();
const isPermanentlyDenied = await audioService.isPermanentlyDenied();
```

#### Start Recording

```typescript
const success = await audioService.startRecording();
if (success) {
  console.log('Recording started');
}
```

#### Stop Recording

```typescript
const audioFilePath = await audioService.stopRecording();
if (audioFilePath) {
  console.log('Recording saved to:', audioFilePath);
}
```

#### Subscribe to Audio Levels

```typescript
const unsubscribe = audioService.subscribeToAudioLevel((level) => {
  console.log('Audio level (0-1):', level);
});

// Later, unsubscribe
unsubscribe();
```

#### Monitoring Mode (Test Audio Levels)

```typescript
// Start monitoring without saving
await audioService.startMonitoring();

// Stop monitoring
await audioService.stopMonitoring();
```

#### Check Recording Status

```typescript
const isRecording = await audioService.isRecording();
```

#### Cleanup

```typescript
await audioService.dispose();
```

### Background Recording

#### iOS
Background audio is enabled via `UIBackgroundModes: ["audio"]` in app.json. The audio session is configured to stay active in the background.

#### Android
Uses expo-notifications to display a foreground service notification during recording. The notification includes a "Stop Recording" action button.

### Audio Configuration

- **Sample Rate**: 16kHz (optimal for speech recognition)
- **Channels**: 1 (mono)
- **Bit Rate**: 128kbps
- **Format**: WAV (uncompressed, best for transcription)
- **Amplitude Update Rate**: ~60fps (16ms intervals)

### Audio Level Processing

The service implements an exponential smoothing algorithm for audio level visualization:

1. Raw amplitude (dB) is normalized to 0-1 range
2. Squared for perceptual scaling
3. Exponentially smoothed with adaptive alpha
4. Different smoothing for rising vs falling levels
5. Clamped to 0.02-1.0 range for visualization

### Required Dependencies

- `expo-av` - Audio recording and permissions
- `expo-audio` - Audio API
- `expo-haptics` - Haptic feedback
- `expo-file-system` - File operations
- `expo-task-manager` - Background tasks
- `expo-notifications` - Foreground service (Android)

### Required Permissions

#### iOS (Info.plist)
```xml
<key>NSMicrophoneUsageDescription</key>
<string>Echos needs access to your microphone to record audio for transcription.</string>
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>
```

#### Android (AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
```

### Migration Notes

This service was migrated from Flutter's AudioService which used:
- `record` package for audio recording
- `haptic_feedback` for haptics
- `flutter_foreground_task` for background service

Key differences:
- expo-av handles recording instead of record package
- Amplitude metering extracted from recording status
- EventEmitter pattern replaces Dart Streams
- expo-notifications provides foreground service on Android

### Error Handling

All public methods include comprehensive error handling:
- Permission errors return false
- Recording errors cleanup and return null/false
- Cleanup methods catch and log errors silently
- Background service failures don't prevent recording

