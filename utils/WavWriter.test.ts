import {
  appendFile,
  exists,
  readFile,
  unlink,
  writeFile,
} from "@dr.pogodin/react-native-fs";

import { createPcmStreamWriter } from "./WavWriter";

jest.mock("./log", () => ({
  FeatureFlag: { recording: "RECORDING" },
  logError: jest.fn(),
}));

describe("createPcmStreamWriter", () => {
  const outputPath = "/mock/output.wav";
  const tempPath = "/mock/output.wav.pcm";
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;

  beforeEach(() => {
    jest.clearAllMocks();
    (exists as jest.Mock).mockResolvedValue(true);
    (writeFile as jest.Mock).mockResolvedValue(undefined);
    (appendFile as jest.Mock).mockResolvedValue(undefined);
    (readFile as jest.Mock).mockResolvedValue("bW9jayBwY20gZGF0YQ==");
    (unlink as jest.Mock).mockResolvedValue(undefined);
  });

  describe("creation", () => {
    it("returns correct interface", () => {
      const writer = createPcmStreamWriter(
        outputPath,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      expect(writer.write).toBeInstanceOf(Function);
      expect(writer.finalize).toBeInstanceOf(Function);
      expect(writer.abort).toBeInstanceOf(Function);
      expect(writer.getByteCount).toBeInstanceOf(Function);
    });

    it("initial byteCount is 0", () => {
      const writer = createPcmStreamWriter(
        outputPath,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      expect(writer.getByteCount()).toBe(0);
    });
  });

  describe("write", () => {
    it("first chunk uses writeFile on temp path", async () => {
      const writer = createPcmStreamWriter(
        outputPath,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      writer.write("AAAA");
      // Flush the write queue via a microtask tick
      await new Promise((r) => setTimeout(r, 0));
      expect(writeFile).toHaveBeenCalledWith(tempPath, "AAAA", "base64");
    });

    it("subsequent chunks use appendFile", async () => {
      const writer = createPcmStreamWriter(
        outputPath,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      writer.write("AAAA");
      writer.write("BBBB");
      await new Promise((r) => setTimeout(r, 0));
      expect(writeFile).toHaveBeenCalledWith(tempPath, "AAAA", "base64");
      expect(appendFile).toHaveBeenCalledWith(tempPath, "BBBB", "base64");
    });

    it("tracks byte count", () => {
      const writer = createPcmStreamWriter(
        outputPath,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      // "AAAA" = 3 bytes, "BBBBBB==" = 4 bytes
      writer.write("AAAA");
      expect(writer.getByteCount()).toBe(3);
      writer.write("BBBBBB==");
      expect(writer.getByteCount()).toBe(7);
    });

    it("ignores writes after finalize", async () => {
      const writer = createPcmStreamWriter(
        outputPath,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      writer.write("AAAA");
      await writer.finalize();
      jest.clearAllMocks();
      writer.write("CCCC");
      expect(writer.getByteCount()).toBe(3); // unchanged
    });

    it("ignores writes after abort", async () => {
      const writer = createPcmStreamWriter(
        outputPath,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      writer.write("AAAA");
      await writer.abort();
      jest.clearAllMocks();
      writer.write("CCCC");
      expect(writer.getByteCount()).toBe(3); // unchanged
    });
  });

  describe("finalize", () => {
    it("writes WAV header then appends PCM data and cleans up temp", async () => {
      const writer = createPcmStreamWriter(
        outputPath,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      writer.write("AAAA");
      const result = await writer.finalize();

      expect(result).toBe(true);
      // Should write WAV header to output path
      expect(writeFile).toHaveBeenCalledWith(
        outputPath,
        expect.any(String),
        "base64",
      );
      // Should read PCM data from temp path
      expect(readFile).toHaveBeenCalledWith(tempPath, "base64");
      // Should append PCM data to output
      expect(appendFile).toHaveBeenCalledWith(
        outputPath,
        expect.any(String),
        "base64",
      );
      // Should clean up temp file
      expect(unlink).toHaveBeenCalledWith(tempPath);
    });

    it("returns false when 0 bytes written", async () => {
      const writer = createPcmStreamWriter(
        outputPath,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      const result = await writer.finalize();
      expect(result).toBe(false);
    });

    it("returns false on double finalize", async () => {
      const writer = createPcmStreamWriter(
        outputPath,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      writer.write("AAAA");
      const first = await writer.finalize();
      const second = await writer.finalize();
      expect(first).toBe(true);
      expect(second).toBe(false);
    });
  });

  describe("abort", () => {
    it("cleans up both temp and output files", async () => {
      const writer = createPcmStreamWriter(
        outputPath,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      writer.write("AAAA");
      await writer.abort();

      expect(exists).toHaveBeenCalledWith(tempPath);
      expect(exists).toHaveBeenCalledWith(outputPath);
      expect(unlink).toHaveBeenCalledWith(tempPath);
      expect(unlink).toHaveBeenCalledWith(outputPath);
    });
  });
});
