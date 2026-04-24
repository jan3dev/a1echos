import { ModelType } from "./ModelType";

describe("ModelType", () => {
  it("has exactly 2 values", () => {
    expect(Object.values(ModelType)).toHaveLength(2);
  });

  it('has WHISPER_FILE = "whisper_file"', () => {
    expect(ModelType.WHISPER_FILE).toBe("whisper_file");
  });

  it('has WHISPER_REALTIME = "whisper_realtime"', () => {
    expect(ModelType.WHISPER_REALTIME).toBe("whisper_realtime");
  });
});
