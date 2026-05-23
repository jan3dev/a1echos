// EncryptionService remains in PR 1 only to decrypt legacy data inside the
// one-shot migration runner. Removed in PR 2 once telemetry confirms the
// migration has baked across the user base.
export {
  encryptionService,
  default as encryptionServiceDefault,
} from "./encryption-service/EncryptionService";

export { databaseService } from "./database-service";

export { audioProtectionService } from "./audio-protection-service";

export {
  backgroundRecordingService,
  default as backgroundRecordingServiceDefault,
  registerForegroundService,
} from "./background-recording-service/BackgroundRecordingService";

export {
  sherpaTranscriptionService,
  default as sherpaTranscriptionServiceDefault,
} from "./sherpa-transcription-service/SherpaTranscriptionService";
export type {
  ChunkBoundary,
  ChunkEvent,
  StartRealtimeOptions,
} from "./sherpa-transcription-service/SherpaTranscriptionService";

export {
  shareService,
  default as shareServiceDefault,
} from "./share-service/ShareService";

export {
  permissionService,
  default as permissionServiceDefault,
} from "./permission-service/PermissionService";
export type { RecordPermissionResult } from "./permission-service/PermissionService";

export {
  audioSessionService,
  default as audioSessionServiceDefault,
} from "./audio-session-service/AudioSessionService";

export {
  modelDownloadService,
  default as modelDownloadServiceDefault,
} from "./model-download-service/ModelDownloadService";
export type { DownloadProgress } from "./model-download-service/ModelDownloadService";
