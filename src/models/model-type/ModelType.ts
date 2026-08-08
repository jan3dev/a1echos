/** @deprecated Use ModelId + TranscriptionMode instead. Kept for settings migration. */
export enum ModelType {
  WHISPER_FILE = "whisper_file",
  WHISPER_REALTIME = "whisper_realtime",
}

export enum ModelId {
  WHISPER_TINY = "whisper_tiny",
  WHISPER_BASE = "whisper_base",
  WHISPER_SMALL = "whisper_small",
  NEMO_PARAKEET_V3 = "nemo_parakeet_v3",
  QWEN3_ASR = "qwen3_asr",
  /** Keyboard autocorrect language model (GGUF), not an ASR model — never a
   *  valid transcription selection. The id doubles as the download directory
   *  name the native keyboards read from (`models/keyboard_lm/`). */
  KEYBOARD_LM = "keyboard_lm",
}

export enum TranscriptionMode {
  FILE = "file",
  REALTIME = "realtime",
}
