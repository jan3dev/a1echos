/** @deprecated Use ModelId + TranscriptionMode instead. Kept for settings migration. */
export enum ModelType {
  WHISPER_FILE = "whisper_file",
  WHISPER_REALTIME = "whisper_realtime",
}

export enum ModelId {
  WHISPER_TINY = "whisper_tiny",
  NEMO_PARAKEET_V3 = "nemo_parakeet_v3",
}

export enum TranscriptionMode {
  FILE = "file",
  REALTIME = "realtime",
}
