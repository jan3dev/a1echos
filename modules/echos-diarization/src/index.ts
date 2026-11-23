import { requireOptionalNativeModule } from "expo-modules-core";

interface NativeShape {
  /**
   * One voice embedding per `[start, end)` sample pair in `ranges` (flat:
   * start0, end0, start1, …), read from a 16 kHz mono 16-bit WAV. A range too
   * short for the model yields an empty array. The model stays loaded between
   * calls until {@link NativeShape.release}.
   */
  embed(
    wavUri: string,
    modelUri: string,
    ranges: number[],
  ): Promise<number[][]>;
  release(): Promise<void>;
}

export const EchosDiarization =
  requireOptionalNativeModule<NativeShape>("EchosDiarization");
