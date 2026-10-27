import {
  type EventSubscription,
  requireOptionalNativeModule,
} from "expo-modules-core";

interface NativeShape {
  /** Fires when the keyboard wants a dictation transcribed on
   *  the app's engine. `path` is a 16 kHz mono 16-bit PCM WAV. */
  addListener(
    eventName: "onTranscribeRequest",
    listener: (event: { id: string; path: string }) => void,
  ): EventSubscription;
  /** Replies to the request `id`; the listener forwards it to the keyboard. */
  completeTranscription(
    id: string,
    text: string | null,
    error: string | null,
  ): void;
}

export const EchosKeyboardBridge = requireOptionalNativeModule<NativeShape>(
  "EchosKeyboardBridge",
);
