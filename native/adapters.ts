import AudioRecord from "@fugood/react-native-audio-pcm-stream";
import AesGcmCrypto from "react-native-aes-gcm-crypto";
import { File } from "expo-file-system";

import type { IFileSystem, NativeModules } from "./types";

const decodeBase64 = (b64: string): Uint8Array =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

const fileSystem: IFileSystem = {
  writeFile: async (path, content, encoding) => {
    const file = new File(`file://${path}`);
    if (encoding === "base64") {
      file.write(decodeBase64(content));
    } else {
      file.write(content);
    }
  },
  appendFile: async (path, content, encoding) => {
    const file = new File(`file://${path}`);
    if (encoding === "base64") {
      file.write(decodeBase64(content), { append: true });
    } else {
      file.write(content, { append: true });
    }
  },
  readFile: async (path, encoding) => {
    const file = new File(`file://${path}`);
    if (encoding === "base64") {
      return file.base64Sync();
    }
    return file.textSync();
  },
  unlink: async (path) => {
    const file = new File(`file://${path}`);
    if (file.exists) file.delete();
  },
  exists: async (path) => {
    return new File(`file://${path}`).exists;
  },
};

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

  fileSystem,
};
