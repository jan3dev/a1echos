import { AppConstants } from "./AppConstants";

describe("AppConstants", () => {
  it("SESSION_NAME_MAX_LENGTH = 30", () => {
    expect(AppConstants.SESSION_NAME_MAX_LENGTH).toBe(30);
  });

  it("AUDIO_SAMPLE_RATE = 16000", () => {
    expect(AppConstants.AUDIO_SAMPLE_RATE).toBe(16000);
  });

  it("AUDIO_NUM_CHANNELS = 1", () => {
    expect(AppConstants.AUDIO_NUM_CHANNELS).toBe(1);
  });

  it("WORDS_PER_PARAGRAPH = 30", () => {
    expect(AppConstants.WORDS_PER_PARAGRAPH).toBe(30);
  });

  it("SENTENCES_PER_PARAGRAPH = 3", () => {
    expect(AppConstants.SENTENCES_PER_PARAGRAPH).toBe(3);
  });

  it("SMART_SPLIT_LONG_PAUSE_MS = 3000", () => {
    expect(AppConstants.SMART_SPLIT_LONG_PAUSE_MS).toBe(3000);
  });

  it("SMART_SPLIT_MAX_ITEM_MS = 60000", () => {
    expect(AppConstants.SMART_SPLIT_MAX_ITEM_MS).toBe(60000);
  });

  it("SMART_SPLIT_SILENCE_ENERGY_THRESHOLD = 0.02", () => {
    expect(AppConstants.SMART_SPLIT_SILENCE_ENERGY_THRESHOLD).toBe(0.02);
  });
});
