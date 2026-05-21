import { Paths } from "expo-file-system";

import { ModelId, getModelInfo } from "@/models";

import { modelDownloadService } from "./ModelDownloadService";

jest.mock("expo-file-system/legacy", () => ({
  createDownloadResumable: jest.fn(),
}));

const setAvailableDiskSpace = (value: number | (() => number)): void => {
  Object.defineProperty(Paths, "availableDiskSpace", {
    configurable: true,
    get: typeof value === "function" ? value : () => value,
  });
};

describe("ModelDownloadService.checkDiskSpace", () => {
  const modelId = ModelId.NEMO_PARAKEET_V3;
  const required = getModelInfo(modelId).sizeBytes;

  afterEach(() => {
    delete (Paths as { availableDiskSpace?: number }).availableDiskSpace;
  });

  it("reports sufficient when available exceeds 110% of model size", async () => {
    setAvailableDiskSpace(required * 2);

    const result = await modelDownloadService.checkDiskSpace(modelId);

    expect(result).toEqual({
      available: required * 2,
      required,
      sufficient: true,
    });
  });

  it("reports insufficient when available is exactly 110% of model size", async () => {
    setAvailableDiskSpace(Math.ceil(required * 1.1));

    const result = await modelDownloadService.checkDiskSpace(modelId);

    expect(result.sufficient).toBe(false);
    expect(result.required).toBe(required);
  });

  it("reports insufficient when available is below required", async () => {
    setAvailableDiskSpace(required - 1);

    const result = await modelDownloadService.checkDiskSpace(modelId);

    expect(result.sufficient).toBe(false);
    expect(result.available).toBe(required - 1);
  });

  it("reports insufficient with available=0 when the disk-space getter throws", async () => {
    setAvailableDiskSpace(() => {
      throw new Error("disk query failed");
    });

    const result = await modelDownloadService.checkDiskSpace(modelId);

    expect(result).toEqual({ available: 0, required, sufficient: false });
  });
});
