import { AppConstants } from "./AppConstants";

describe("AppConstants", () => {
  it("SESSION_NAME_MAX_LENGTH = 30", () => {
    expect(AppConstants.SESSION_NAME_MAX_LENGTH).toBe(30);
  });

  it("AUDIO_SAMPLE_RATE = 16000", () => {
    expect(AppConstants.AUDIO_SAMPLE_RATE).toBe(16000);
  });

  it("AUDIO_BIT_RATE = 128000", () => {
    expect(AppConstants.AUDIO_BIT_RATE).toBe(128000);
  });

  it("AUDIO_NUM_CHANNELS = 1", () => {
    expect(AppConstants.AUDIO_NUM_CHANNELS).toBe(1);
  });

  it('AUDIO_ENCODER = "wav"', () => {
    expect(AppConstants.AUDIO_ENCODER).toBe("wav");
  });

  it("WORDS_PER_PARAGRAPH = 30", () => {
    expect(AppConstants.WORDS_PER_PARAGRAPH).toBe(30);
  });

  it("SENTENCES_PER_PARAGRAPH = 3", () => {
    expect(AppConstants.SENTENCES_PER_PARAGRAPH).toBe(3);
  });
});
