import type { EventSubscription } from "expo-modules-core";

import { EchosKeyboardBridge } from "@modules/echos-keyboard-bridge/src";
import { sherpaTranscriptionService } from "@/services";
import {
  FeatureFlag,
  formatTranscriptionText,
  getErrorMessage,
  logError,
} from "@/utils";

import { useSettingsStore } from "../settings-store/settingsStore";

let subscription: EventSubscription | undefined;

/**
 * Answers keyboard dictations handed to the app (models the keyboard can't
 * run, e.g. Qwen3, Nemotron) using the already-loaded engine. Any error reply
 * makes the keyboard fall back to its native model.
 */
export const startKeyboardTranscriptionBridge = (): void => {
  const bridge = EchosKeyboardBridge;
  if (!bridge || subscription) return;
  subscription = bridge.addListener(
    "onTranscribeRequest",
    async ({ id, path }) => {
      try {
        const { selectedModelId, selectedLanguage } =
          useSettingsStore.getState();
        if (
          !(await sherpaTranscriptionService.initialize(
            selectedModelId,
            selectedLanguage.code,
          ))
        ) {
          throw new Error("Voice model failed to load");
        }
        const text = formatTranscriptionText(
          await sherpaTranscriptionService.transcribeWavFile(`file://${path}`),
        );
        bridge.completeTranscription(id, text, null);
      } catch (error) {
        logError(error, {
          flag: FeatureFlag.model,
          message: "Keyboard transcription on the app engine failed",
        });
        bridge.completeTranscription(id, null, getErrorMessage(error));
      }
    },
  );
};
