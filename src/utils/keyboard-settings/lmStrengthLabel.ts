export type LmStrengthLabelKey =
  | "lmStrengthSubtle"
  | "lmStrengthBalanced"
  | "lmStrengthStrong"
  | "lmStrengthMax";

/**
 * Maps a keyboard LM strength (0…2 blend weight) to its localization key.
 * `1.0` and any unknown value fall back to the balanced label. Shared by the
 * Advanced settings row and the strength picker so the mapping lives in one
 * place.
 */
export const lmStrengthLabelKey = (strength: number): LmStrengthLabelKey => {
  switch (strength) {
    case 0.5:
      return "lmStrengthSubtle";
    case 1.5:
      return "lmStrengthStrong";
    case 2.0:
      return "lmStrengthMax";
    default:
      return "lmStrengthBalanced";
  }
};

export type LmStrengthExampleKey = `${LmStrengthLabelKey}Example`;

/**
 * The one-line "what this actually does" blurb under each option in the
 * strength picker — "Subtle" through "Maximum" mean nothing on their own.
 * Derived from the label key so the two can never fall out of step.
 */
export const lmStrengthExampleKey = (strength: number): LmStrengthExampleKey =>
  `${lmStrengthLabelKey(strength)}Example`;
