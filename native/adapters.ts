import AudioRecord from "@fugood/react-native-audio-pcm-stream";
import AesGcmCrypto from "react-native-aes-gcm-crypto";
import RNFS from "react-native-fs";
import { initWhisper, initWhisperVad } from "whisper.rn";
import { RealtimeTranscriber } from "whisper.rn/src/realtime-transcription";
import { AudioPcmStreamAdapter } from "whisper.rn/src/realtime-transcription/adapters/AudioPcmStreamAdapter";

import type { NativeModules } from "./types";

export const nativeModules: NativeModules = {
  audioPcmStream: {
    init: (config) => AudioRecord.init(config),
    on: (event, callback) => AudioRecord.on(event, callback),
    start: () => AudioRecord.start(),
    stop: async () => {
      await AudioRecord.stop();
    },
  },

  aesGcmCrypto: {
    encrypt: (plainText, aad, key) => AesGcmCrypto.encrypt(plainText, aad, key),
    decrypt: (content, key, iv, tag, aad) =>
      AesGcmCrypto.decrypt(content, key, iv, tag, aad),
  },

  fileSystem: RNFS,

  whisperModule: {
    initWhisper: (options) => initWhisper(options),
    initWhisperVad: (options) => initWhisperVad(options),
    createRealtimeTranscriber: (config, options, callbacks) =>
      new RealtimeTranscriber(config, options, callbacks),
    createAudioPcmStreamAdapter: () => new AudioPcmStreamAdapter(),
  },
};
