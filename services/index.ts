export {
  encryptionService,
  default as encryptionServiceDefault,
} from "./encryption-service/EncryptionService";

export {
  storageService,
  default as storageServiceDefault,
} from "./storage-service/StorageService";

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
