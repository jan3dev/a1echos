/* eslint-disable @typescript-eslint/no-require-imports */
import type { NativeModules } from "./types/types";

const isStorybook = process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === "true";

// Dynamic require is intentional: adapters.ts imports native modules that
// crash at evaluation time in Storybook (no native bridge). The conditional
// ensures the adapter module factory never executes in that environment.

const modules: NativeModules = isStorybook
  ? require("./mocks/mocks").nativeModules
  : require("./adapters/adapters").nativeModules;

export const { aesGcmCrypto } = modules;

export type {
  EncryptResult,
  IAesGcmCrypto,
  NativeModules,
} from "./types/types";
