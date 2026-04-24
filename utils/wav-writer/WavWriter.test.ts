import { File } from "expo-file-system";

import { createPcmStreamWriter } from "./WavWriter";

jest.mock("../log/log", () => ({
  FeatureFlag: { recording: "RECORDING" },
  logError: jest.fn(),
}));

const MockFile = File as unknown as jest.Mock;

// Per-path File instance so writes/reads can be tracked independently.
const fileInstances = new Map<string, ReturnType<typeof makeFileInstance>>();
const makeFileInstance = (uri: string) => ({
  uri,
  exists: true,
  write: jest.fn(),
  bytesSync: jest.fn(() => new Uint8Array([1, 2, 3, 4])),
  delete: jest.fn(),
});

const getFileInstance = (uri: string) => {
  if (!fileInstances.has(uri)) {
    fileInstances.set(uri, makeFileInstance(uri));
  }
  return fileInstances.get(uri)!;
};

describe("createPcmStreamWriter", () => {
  const outputUri = "file:///mock/output.wav";
  const tempUri = "file:///mock/output.wav.pcm";
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;

  beforeEach(() => {
    fileInstances.clear();
    MockFile.mockReset().mockImplementation((uri: string) =>
      getFileInstance(uri),
    );
  });

  const flush = async () => {
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
  };

  const tempFile = () => getFileInstance(tempUri);
  const outFile = () => getFileInstance(outputUri);

  const makeChunk = (byteLength: number): Uint8Array =>
    new Uint8Array(byteLength);

  describe("creation", () => {
    it("returns correct interface", () => {
      const writer = createPcmStreamWriter(
        outputUri,
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
        outputUri,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      expect(writer.getByteCount()).toBe(0);
    });
  });

  describe("write", () => {
    it("first chunk writes bytes to the temp path (no append flag)", async () => {
      const writer = createPcmStreamWriter(
        outputUri,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      writer.write(makeChunk(4));
      await flush();
      expect(tempFile().write).toHaveBeenCalledTimes(1);
      const [bytes, options] = tempFile().write.mock.calls[0];
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect((bytes as Uint8Array).byteLength).toBe(4);
      expect(options).toBeUndefined();
    });

    it("subsequent chunks append to the temp path", async () => {
      const writer = createPcmStreamWriter(
        outputUri,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      writer.write(makeChunk(4));
      writer.write(makeChunk(4));
      await flush();
      expect(tempFile().write).toHaveBeenCalledTimes(2);
      expect(tempFile().write.mock.calls[1][1]).toEqual({ append: true });
    });

    it("tracks byte count from Uint8Array lengths", () => {
      const writer = createPcmStreamWriter(
        outputUri,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      writer.write(makeChunk(3));
      expect(writer.getByteCount()).toBe(3);
      writer.write(makeChunk(7));
      expect(writer.getByteCount()).toBe(10);
    });

    it("ignores writes after finalize", async () => {
      const writer = createPcmStreamWriter(
        outputUri,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      writer.write(makeChunk(3));
      await writer.finalize();
      writer.write(makeChunk(4));
      expect(writer.getByteCount()).toBe(3);
    });

    it("ignores writes after abort", async () => {
      const writer = createPcmStreamWriter(
        outputUri,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      writer.write(makeChunk(3));
      await writer.abort();
      writer.write(makeChunk(4));
      expect(writer.getByteCount()).toBe(3);
    });

    it("flags hasError and stops writing when File.write throws", async () => {
      const writer = createPcmStreamWriter(
        outputUri,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      tempFile().write.mockImplementationOnce(() => {
        throw new Error("disk full");
      });
      writer.write(makeChunk(4));
      await flush();
      // A subsequent write should short-circuit — queue still counted bytes
      // but File.write is not invoked again.
      writer.write(makeChunk(4));
      await flush();
      expect(tempFile().write).toHaveBeenCalledTimes(1);
    });
  });

  describe("finalize", () => {
    it("writes header + appends PCM bytes, then deletes temp", async () => {
      const writer = createPcmStreamWriter(
        outputUri,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      writer.write(makeChunk(8));
      const result = await writer.finalize();

      expect(result).toBe(true);
      // Output file gets two writes: header first (no options), then PCM append.
      expect(outFile().write).toHaveBeenCalledTimes(2);
      const [header, headerOpts] = outFile().write.mock.calls[0];
      expect(header).toBeInstanceOf(Uint8Array);
      expect((header as Uint8Array).byteLength).toBe(44);
      expect(headerOpts).toBeUndefined();
      expect(outFile().write.mock.calls[1][1]).toEqual({ append: true });
      expect(tempFile().bytesSync).toHaveBeenCalled();
      expect(tempFile().delete).toHaveBeenCalled();
    });

    it("returns false when 0 bytes written", async () => {
      const writer = createPcmStreamWriter(
        outputUri,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      const result = await writer.finalize();
      expect(result).toBe(false);
    });

    it("returns false on double finalize", async () => {
      const writer = createPcmStreamWriter(
        outputUri,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      writer.write(makeChunk(4));
      const first = await writer.finalize();
      const second = await writer.finalize();
      expect(first).toBe(true);
      expect(second).toBe(false);
    });

    it("returns false and cleans up on write error", async () => {
      const writer = createPcmStreamWriter(
        outputUri,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      outFile().write.mockImplementationOnce(() => {
        throw new Error("header write failed");
      });
      writer.write(makeChunk(4));
      const result = await writer.finalize();
      expect(result).toBe(false);
      expect(outFile().delete).toHaveBeenCalled();
    });
  });

  describe("abort", () => {
    it("cleans up both temp and output files", async () => {
      const writer = createPcmStreamWriter(
        outputUri,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      writer.write(makeChunk(4));
      await writer.abort();

      expect(tempFile().delete).toHaveBeenCalled();
      expect(outFile().delete).toHaveBeenCalled();
    });

    it("is a no-op after a successful finalize — keeps the output file", async () => {
      const writer = createPcmStreamWriter(
        outputUri,
        sampleRate,
        numChannels,
        bitsPerSample,
      );
      writer.write(makeChunk(4));
      const finalizeResult = await writer.finalize();
      expect(finalizeResult).toBe(true);

      outFile().delete.mockClear();
      tempFile().delete.mockClear();

      await writer.abort();

      // The finalized WAV must not be deleted by a subsequent abort call.
      expect(outFile().delete).not.toHaveBeenCalled();
      expect(tempFile().delete).not.toHaveBeenCalled();
    });
  });
});
