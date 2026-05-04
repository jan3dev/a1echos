import { TranscriptionState } from "./TranscriptionState";

describe("TranscriptionState", () => {
  it("has exactly 7 values", () => {
    expect(Object.values(TranscriptionState)).toHaveLength(7);
  });

  it.each([
    ["LOADING", "loading"],
    ["READY", "ready"],
    ["RECORDING_STARTING", "recording_starting"],
    ["RECORDING", "recording"],
    ["TRANSCRIBING", "transcribing"],
    ["STREAMING", "streaming"],
    ["ERROR", "error"],
  ] as const)('has %s = "%s"', (key, value) => {
    expect(TranscriptionState[key as keyof typeof TranscriptionState]).toBe(
      value,
    );
  });
});
