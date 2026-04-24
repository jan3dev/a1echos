export {
  encryptionService,
  default as encryptionServiceDefault,
} from "./EncryptionService";

export {
  storageService,
  default as storageServiceDefault,
} from "./StorageService";

export {
  backgroundRecordingService,
  default as backgroundRecordingServiceDefault,
  registerForegroundService,
} from "./BackgroundRecordingService";

export {
  sherpaTranscriptionService,
  default as sherpaTranscriptionServiceDefault,
} from "./SherpaTranscriptionService";
export type {
  ChunkBoundary,
  ChunkEvent,
  StartRealtimeOptions,
} from "./SherpaTranscriptionService";

export { shareService, default as shareServiceDefault } from "./ShareService";

export {
  permissionService,
  default as permissionServiceDefault,
} from "./PermissionService";
export type { RecordPermissionResult } from "./PermissionService";

export {
  audioSessionService,
  default as audioSessionServiceDefault,
} from "./AudioSessionService";

export {
  modelDownloadService,
  default as modelDownloadServiceDefault,
} from "./ModelDownloadService";
export type { DownloadProgress } from "./ModelDownloadService";
