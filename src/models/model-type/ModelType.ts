/** Pre-ModelId setting, only read to migrate old installs to ModelId + TranscriptionMode. */
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
  NEMOTRON_STREAMING_EN = "nemotron_streaming_en",
  OMNILINGUAL = "omnilingual",
}

export enum TranscriptionMode {
  FILE = "file",
  REALTIME = "realtime",
}

export enum LlmModelId {
  QWEN35_0_8B_EN = "qwen35_0_8b_en",
  QWEN35_0_8B = "qwen35_0_8b",
  QWEN35_2B = "qwen35_2b",
  QWEN35_4B = "qwen35_4b",
}
