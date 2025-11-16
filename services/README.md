# Services

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

