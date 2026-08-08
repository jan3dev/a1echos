import { renderHook } from "@testing-library/react-native";

import { ModelId } from "@/models";

import { useEnsureModelDownloaded } from "./useEnsureModelDownloaded";

const mockCheckDiskSpace = jest.fn();
jest.mock("@/services", () => ({
  modelDownloadService: {
    checkDiskSpace: (...args: unknown[]) => mockCheckDiskSpace(...args),
  },
}));

const mockStartDownload = jest.fn();
const mockGetProgress = jest.fn();
const mockShowGlobalTooltip = jest.fn();
jest.mock("@/stores", () => ({
  useModelDownloadStore: jest.fn(() => ({
    startDownload: mockStartDownload,
    getProgress: mockGetProgress,
  })),
  useShowGlobalTooltip: jest.fn(() => mockShowGlobalTooltip),
}));

jest.mock("../use-localization/useLocalization", () => ({
  useLocalization: jest.fn(() => ({
    loc: {
      insufficientSpace: (required: string, available: string) =>
        `insufficientSpace_${required}_${available}`,
      downloadFailed: "downloadFailed",
    },
  })),
}));

jest.mock("@/utils", () => ({
  formatBytes: (n: number) => `${n}B`,
}));

const ensure = () =>
  renderHook(() => useEnsureModelDownloaded()).result.current;

describe("useEnsureModelDownloaded", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProgress.mockReturnValue(undefined);
    mockCheckDiskSpace.mockResolvedValue({
      available: 1_000_000_000,
      required: 100,
      sufficient: true,
    });
    mockStartDownload.mockResolvedValue(true);
  });

  it("starts the download and resolves true on success", async () => {
    await expect(ensure()(ModelId.NEMO_PARAKEET_V3)).resolves.toBe(true);
    expect(mockStartDownload).toHaveBeenCalledWith(ModelId.NEMO_PARAKEET_V3);
    expect(mockShowGlobalTooltip).not.toHaveBeenCalled();
  });

  it("no-ops while a download for the same model is already in flight", async () => {
    mockGetProgress.mockReturnValue({ status: "downloading" });
    await expect(ensure()(ModelId.NEMO_PARAKEET_V3)).resolves.toBe(false);
    expect(mockCheckDiskSpace).not.toHaveBeenCalled();
    expect(mockStartDownload).not.toHaveBeenCalled();
  });

  it("warns and skips the download when disk space is insufficient", async () => {
    mockCheckDiskSpace.mockResolvedValue({
      available: 50_000_000,
      required: 670_000_000,
      sufficient: false,
    });
    await expect(ensure()(ModelId.NEMO_PARAKEET_V3)).resolves.toBe(false);
    expect(mockShowGlobalTooltip).toHaveBeenCalledWith(
      expect.stringContaining("insufficientSpace"),
      "error",
      5000,
    );
    expect(mockStartDownload).not.toHaveBeenCalled();
  });

  it("surfaces a toast when the download fails", async () => {
    mockStartDownload.mockResolvedValue(false);
    mockGetProgress
      .mockReturnValueOnce(undefined) // in-flight guard
      .mockReturnValue({ status: "error" });
    await expect(ensure()(ModelId.NEMO_PARAKEET_V3)).resolves.toBe(false);
    expect(mockShowGlobalTooltip).toHaveBeenCalledWith(
      "downloadFailed",
      "error",
      5000,
    );
  });

  it("stays silent when the user cancelled the download", async () => {
    mockStartDownload.mockResolvedValue(false);
    mockGetProgress
      .mockReturnValueOnce(undefined) // in-flight guard
      .mockReturnValue({ status: "cancelled" });
    await expect(ensure()(ModelId.NEMO_PARAKEET_V3)).resolves.toBe(false);
    expect(mockShowGlobalTooltip).not.toHaveBeenCalled();
  });
});
