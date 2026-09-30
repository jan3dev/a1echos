import { requireOptionalNativeModule } from "expo-modules-core";

interface NativeShape {
  /**
   * Decodes `srcUri` (any format the OS can decode, e.g. MP3/WAV) into a
   * 16 kHz mono 16-bit PCM WAV at `dstUri`. Resolves early with a
   * `durationMs` above `maxDurationMs` (output incomplete) when the source is
   * too long; callers enforce the limit.
   */
  decodeToWav16k(
    srcUri: string,
    dstUri: string,
    maxDurationMs: number,
  ): Promise<{ durationMs: number }>;
}

export const EchosAudioDecoder =
  requireOptionalNativeModule<NativeShape>("EchosAudioDecoder");
