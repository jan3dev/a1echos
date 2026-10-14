type MicTimeoutDurationKey =
  | "micTimeout1Min"
  | "micTimeout5Min"
  | "micTimeout20Min"
  | "micTimeout60Min";

export type MicTimeoutLabelKey =
  | "micTimeoutOff"
  | MicTimeoutDurationKey
  | `${MicTimeoutDurationKey}Short`;

/**
 * Maps a keyboard mic-timeout (seconds) to its localization key. `300` and any
 * unknown value fall back to the 5-minute label. Shared by the Advanced
 * settings row (`short`, so the row fits on one line) and the timeout picker
 * (full labels) so the mapping lives in one place.
 */
export const micTimeoutLabelKey = (
  seconds: number,
  short = false,
): MicTimeoutLabelKey => {
  if (seconds === 0) return "micTimeoutOff";
  const key = durationKey(seconds);
  return short ? `${key}Short` : key;
};

const durationKey = (seconds: number): MicTimeoutDurationKey => {
  switch (seconds) {
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
