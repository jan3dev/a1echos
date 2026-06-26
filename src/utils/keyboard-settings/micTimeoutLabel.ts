export type MicTimeoutLabelKey =
  | "micTimeoutOff"
  | "micTimeout1Min"
  | "micTimeout5Min"
  | "micTimeout20Min"
  | "micTimeout60Min";

/**
 * Maps a keyboard mic-timeout (seconds) to its localization key. `300` and any
 * unknown value fall back to the 5-minute label. Shared by the Advanced
 * settings row and the timeout picker so the mapping lives in one place.
 */
export const micTimeoutLabelKey = (seconds: number): MicTimeoutLabelKey => {
  switch (seconds) {
    case 0:
      return "micTimeoutOff";
    case 60:
      return "micTimeout1Min";
    case 1200:
      return "micTimeout20Min";
    case 3600:
      return "micTimeout60Min";
    default:
      return "micTimeout5Min";
  }
};
