import type { NativeModules } from "./types";

const unavailable = (name: string): never => {
  throw new Error(`${name} is not available in Storybook`);
};

export const nativeModules: NativeModules = {
  audioPcmStream: {
    init: () => unavailable("AudioPcmStream"),
    on: () => unavailable("AudioPcmStream"),
    start: () => unavailable("AudioPcmStream"),
    stop: () => unavailable("AudioPcmStream"),
  },

  aesGcmCrypto: {
    encrypt: () => unavailable("AesGcmCrypto"),
    decrypt: () => unavailable("AesGcmCrypto"),
  },

  fileSystem: {
    writeFile: () => unavailable("FileSystem"),
    appendFile: () => unavailable("FileSystem"),
    readFile: () => unavailable("FileSystem"),
    unlink: () => unavailable("FileSystem"),
    exists: () => unavailable("FileSystem"),
  },

  whisperModule: {
    initWhisper: () => unavailable("Whisper"),
    initWhisperVad: () => unavailable("Whisper"),
    createRealtimeTranscriber: () => unavailable("Whisper"),
    createAudioPcmStreamAdapter: () => unavailable("Whisper"),
  },
};
