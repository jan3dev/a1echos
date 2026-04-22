import { File } from "expo-file-system";

import { createPcmStreamWriter } from "./WavWriter";

jest.mock("./log", () => ({
  FeatureFlag: { recording: "RECORDING" },
  logError: jest.fn(),
}));

const MockFile = File as unknown as jest.Mock;

// Per-path File instance so writes/reads can be tracked independently.
const fileInstances = new Map<string, any>();
const makeFileInstance = (uri: string) => {
  if (!fileInstances.has(uri)) {
    fileInstances.set(uri, {
      uri,
      exists: true,
      write: jest.fn(),
      base64Sync: jest.fn(() => "bW9jayBwY20gZGF0YQ=="),
      textSync: jest.fn(() => ""),
      delete: jest.fn(),
    });
  }
  return fileInstances.get(uri);
};

describe("createPcmStreamWriter", () => {
  const outputPath = "/mock/output.wav";
  const tempPath = "/mock/output.wav.pcm";
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;

  beforeEach(() => {
    fileInstances.clear();
    MockFile.mockReset().mockImplementation((uri: string) =>
      makeFileInstance(uri),
    );
  });

  const flush = async () => {
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
  };

  const tempFile = () => makeFileInstance(`file://${tempPath}`);
  const outFile = () => makeFileInstance(`file://${outputPath}`);

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
    it("first chunk writes PCM bytes to the temp path", async () => {
      const writer = createPcmStreamWriter(
        outputPath,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      writer.write("AAAA");
      await flush();
      expect(tempFile().write).toHaveBeenCalled();
      const call = tempFile().write.mock.calls[0];
      expect(call[0]).toBeInstanceOf(Uint8Array);
      expect(call[1]).toBeUndefined();
    });

    it("subsequent chunks append to the temp path", async () => {
      const writer = createPcmStreamWriter(
        outputPath,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      writer.write("AAAA");
      writer.write("BBBB");
      await flush();
      expect(tempFile().write).toHaveBeenCalledTimes(2);
      expect(tempFile().write.mock.calls[1][1]).toEqual({ append: true });
    });

    it("tracks byte count", () => {
      const writer = createPcmStreamWriter(
        outputPath,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
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
      writer.write("CCCC");
      expect(writer.getByteCount()).toBe(3);
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
      writer.write("CCCC");
      expect(writer.getByteCount()).toBe(3);
    });
  });

  describe("finalize", () => {
    it("writes WAV header, appends PCM data, and deletes temp", async () => {
      const writer = createPcmStreamWriter(
        outputPath,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      writer.write("AAAA");
      const result = await writer.finalize();

      expect(result).toBe(true);
      // First call to output: write header (append: undefined/absent)
      expect(outFile().write).toHaveBeenCalled();
      expect(tempFile().base64Sync).toHaveBeenCalled();
      expect(tempFile().delete).toHaveBeenCalled();
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

      expect(tempFile().delete).toHaveBeenCalled();
      expect(outFile().delete).toHaveBeenCalled();
    });
  });
});
