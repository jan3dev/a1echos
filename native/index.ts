/* eslint-disable @typescript-eslint/no-require-imports */
import type { NativeModules } from "./types";

const isStorybook = process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === "true";

// Dynamic require is intentional: adapters.ts imports native modules that
// crash at evaluation time in Storybook (no native bridge). The conditional
// ensures the adapter module factory never executes in that environment.

const modules: NativeModules = isStorybook
  ? require("./mocks").nativeModules
  : require("./adapters").nativeModules;

export const { audioPcmStream, aesGcmCrypto, fileSystem } = modules;

export type {
  AudioPcmStreamConfig,
  EncryptResult,
  IAesGcmCrypto,
  IAudioPcmStream,
  IFileSystem,
  NativeModules
} from "./types";

