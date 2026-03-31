import { TranscriptionState } from "./TranscriptionState";

describe("TranscriptionState", () => {
  it("has exactly 6 values", () => {
    expect(Object.values(TranscriptionState)).toHaveLength(6);
  });

  it.each([
    ["LOADING", "loading"],
    ["READY", "ready"],
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
