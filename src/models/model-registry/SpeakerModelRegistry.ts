import { SpeakerModelId } from "../model-type/ModelType";

import type { ModelFileInfo } from "./ModelRegistry";

export interface SpeakerModelInfo {
  id: SpeakerModelId;
  name: string;
  sizeBytes: number;
  isBundled: boolean;
  /** Pinned to a commit so the model can't change under a released build. */
  downloadBaseUrl: string;
  files: [ModelFileInfo];
}

// NeMo TitaNet Small (CC-BY-4.0): tells voices apart, in any language. Picked
// over WeSpeaker ResNet34 and CAM++ for separating same-gender voices best
// while being the fastest of the three.
export const SPEAKER_MODEL: SpeakerModelInfo = {
  id: SpeakerModelId.TITANET_SMALL,
  name: "TitaNet Small",
  sizeBytes: 40_257_283,
  isBundled: false,
  downloadBaseUrl:
    "https://huggingface.co/csukuangfj/speaker-embedding-models/resolve/0743f301363dec56491a490f6d6cbc9d67f9a3bf",
  files: [{ name: "nemo_en_titanet_small.onnx", sizeBytes: 40_257_283 }],
};
