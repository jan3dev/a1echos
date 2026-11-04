import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

import IntelligenceSettingsScreen from "./intelligence";

const mockSetLlmId = jest.fn(() => Promise.resolve());
const mockShowGlobalTooltip = jest.fn();
let mockSelectedLlmId: string | null = null;
let mockLanguageCode = "en";

const mockDownloadStore = {
  getProgress: jest.fn() as jest.Mock,
  isDownloaded: jest.fn() as jest.Mock,
  cancelDownload: jest.fn(),
  deleteModel: jest.fn() as jest.Mock,
};

jest.mock("@/theme", () => ({
  ...jest.requireActual("@/theme"),
  useTheme: jest.fn(() => ({
    theme: {
      colors: {
        surfaceBackground: "#fff",
        surfacePrimary: "#fff",
        surfaceBorderPrimary: "#ccc",
        textPrimary: "#000",
        textSecondary: "#666",
      },
      typography: new Proxy({}, { get: () => ({ fontSize: 12 }) }),
    },
  })),
}));

const mockEnsureModelDownloaded = jest.fn(() => Promise.resolve(true));
jest.mock("@/hooks", () => ({
  useEnsureModelDownloaded: jest.fn(() => mockEnsureModelDownloaded),
  useScrollSurface: jest.fn(() => ({ scrolled: false, onScroll: jest.fn() })),
  useLocalization: jest.fn(() => ({
    loc: new Proxy(
      {},
      {
        get: (_, p: string) =>
          p === "llmDescription" ? (id: string) => `llmDescription:${id}` : p,
      },
    ),
  })),
}));

const small = {
  id: "qwen35_0_8b_en",
  name: "Qwen3.5 0.8B English",
  sizeBytes: 3.8e8,
  englishOnly: true,
};
const large = { id: "qwen35_4b", name: "Qwen3.5 4B", sizeBytes: 2.5e9 };

const mockGetTotalRamBytes = jest.fn();
jest.mock("@/services", () => ({
  llmService: { getTotalRamBytes: () => mockGetTotalRamBytes() },
}));

jest.mock("@/models", () => ({
  getRecommendedLlmId: jest.fn((ram: number) =>
    ram >= 7e9 ? "qwen35_4b" : "qwen35_0_8b_en",
  ),
  getAllLlms: jest.fn(() => [small, large]),
  getLlmInfo: jest.fn((id: string) => (id === small.id ? small : large)),
}));

jest.mock("@/stores", () => ({
  useModelDownloadStore: jest.fn(() => mockDownloadStore),
  useSelectedLanguage: jest.fn(() => ({ code: mockLanguageCode })),
  useSelectedLlmId: jest.fn(() => mockSelectedLlmId),
  useSetLlmId: jest.fn(() => mockSetLlmId),
  useShowGlobalTooltip: jest.fn(() => mockShowGlobalTooltip),
}));

jest.mock("@/utils", () => ({
  iosPressed: jest.fn(() => 1),
  formatBytes: jest.fn((bytes: number) => `${Math.round(bytes / 1e6)} MB`),
}));

// The real card (its own tests cover it); the barrel would pull in native
// worklets through unrelated screens.
jest.mock("@/components", () => {
  const { View, Text } = jest.requireActual("react-native");
  return {
    AppBarBlurTarget: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
    Screen: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
    Text,
    TopAppBar: () => null,
    LlmCard: jest.requireActual("@/components/domain/settings/llm-card/LlmCard")
      .LlmCard,
  };
});

jest.mock("@/components/ui/toast/Toast", () => ({ Toast: () => null }));

const mockShow = jest.fn();
const mockHide = jest.fn();
jest.mock("@/components/ui/toast/useToast", () => ({
  useToast: () => ({ show: mockShow, hide: mockHide, toastState: {} }),
}));

const confirmDelete = async () => {
  await mockShow.mock.calls[0][0].onPrimaryButtonTap();
};

describe("IntelligenceSettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectedLlmId = null;
    mockLanguageCode = "en";
    mockDownloadStore.getProgress.mockReturnValue(undefined);
    mockDownloadStore.isDownloaded.mockReturnValue(false);
    mockDownloadStore.deleteModel.mockResolvedValue(true);
    mockGetTotalRamBytes.mockResolvedValue(null);
  });

  it("badges the model recommended for the device's RAM", async () => {
    mockGetTotalRamBytes.mockResolvedValue(8e9);
    const { findByText, getAllByText } = render(<IntelligenceSettingsScreen />);
    expect(await findByText("recommended")).toBeTruthy();
    expect(getAllByText("recommended")).toHaveLength(1);
  });

  it("flags English-only models when transcribing another language", () => {
    const { queryByText, rerender } = render(<IntelligenceSettingsScreen />);
    expect(queryByText("llmEnglishOnlyWarning")).toBeNull();
    mockLanguageCode = "de";
    rerender(<IntelligenceSettingsScreen />);
    expect(queryByText("llmEnglishOnlyWarning")).toBeTruthy();
  });

  it("recommends nothing when RAM can't be read", async () => {
    mockGetTotalRamBytes.mockRejectedValue(new Error("no backend"));
    const { queryByText } = render(<IntelligenceSettingsScreen />);
    await waitFor(() => expect(mockGetTotalRamBytes).toHaveBeenCalled());
    expect(queryByText("recommended")).toBeNull();
  });

  it("lists every model under Available when none is downloaded", () => {
    const { getByText, queryByText } = render(<IntelligenceSettingsScreen />);
    expect(getByText("intelligenceDescription")).toBeTruthy();
    expect(getByText("sectionAvailable")).toBeTruthy();
    expect(queryByText("sectionDownloaded")).toBeNull();
    expect(getByText("Qwen3.5 0.8B English")).toBeTruthy();
    expect(getByText("llmDescription:qwen35_4b")).toBeTruthy();
  });

  it("downloads a model and selects it on success", async () => {
    const { getAllByText } = render(<IntelligenceSettingsScreen />);
    fireEvent.press(getAllByText("download")[0]);
    await waitFor(() =>
      expect(mockSetLlmId).toHaveBeenCalledWith("qwen35_0_8b_en"),
    );
    expect(mockEnsureModelDownloaded).toHaveBeenCalledWith("qwen35_0_8b_en");
  });

  it("does not select a model whose download failed", async () => {
    mockEnsureModelDownloaded.mockResolvedValueOnce(false);
    const { getAllByText } = render(<IntelligenceSettingsScreen />);
    fireEvent.press(getAllByText("download")[0]);
    await waitFor(() => expect(mockEnsureModelDownloaded).toHaveBeenCalled());
    expect(mockSetLlmId).not.toHaveBeenCalled();
  });

  it("offers a retry after a failed download", async () => {
    mockDownloadStore.getProgress.mockImplementation((id: string) =>
      id === small.id ? { status: "error" } : undefined,
    );
    const { getByText } = render(<IntelligenceSettingsScreen />);
    expect(getByText("sectionAvailable")).toBeTruthy();
    fireEvent.press(getByText("tryAgain"));
    await waitFor(() =>
      expect(mockEnsureModelDownloaded).toHaveBeenCalledWith("qwen35_0_8b_en"),
    );
  });

  it("cancels an in-flight download", () => {
    mockDownloadStore.getProgress.mockImplementation((id: string) =>
      id === small.id
        ? {
            status: "downloading",
            progressRatio: 0.5,
            downloadedBytes: 2.5e8,
            totalBytes: 5e8,
          }
        : undefined,
    );
    const { getByText } = render(<IntelligenceSettingsScreen />);
    fireEvent.press(getByText("cancel"));
    expect(mockDownloadStore.cancelDownload).toHaveBeenCalledWith(
      "qwen35_0_8b_en",
    );
  });

  it("selects a downloaded model", () => {
    mockDownloadStore.isDownloaded.mockReturnValue(true);
    const { getByTestId, getByText } = render(<IntelligenceSettingsScreen />);
    expect(getByText("sectionDownloaded")).toBeTruthy();
    fireEvent.press(getByTestId("llm-card-qwen35_4b"));
    expect(mockSetLlmId).toHaveBeenCalledWith("qwen35_4b");
  });

  it("falls back to another downloaded model when deleting the selected one", async () => {
    mockSelectedLlmId = small.id;
    mockDownloadStore.isDownloaded.mockReturnValue(true);
    const { getAllByText } = render(<IntelligenceSettingsScreen />);
    fireEvent.press(getAllByText("delete")[0]);
    await confirmDelete();
    expect(mockDownloadStore.deleteModel).toHaveBeenCalledWith("qwen35_0_8b_en");
    expect(mockSetLlmId).toHaveBeenCalledWith("qwen35_4b");
    expect(mockShowGlobalTooltip).toHaveBeenCalledWith(
      "deletedToast",
      "normal",
      3000,
    );
  });

  it("clears the selection when the last downloaded model is deleted", async () => {
    mockSelectedLlmId = small.id;
    mockDownloadStore.isDownloaded.mockImplementation(
      (id: string) => id === small.id,
    );
    const { getByText } = render(<IntelligenceSettingsScreen />);
    fireEvent.press(getByText("delete"));
    await confirmDelete();
    expect(mockSetLlmId).toHaveBeenCalledWith(null);
  });

  it("keeps the selection when deleting another model", async () => {
    mockSelectedLlmId = large.id;
    mockDownloadStore.isDownloaded.mockReturnValue(true);
    const { getAllByText } = render(<IntelligenceSettingsScreen />);
    fireEvent.press(getAllByText("delete")[0]);
    await confirmDelete();
    expect(mockSetLlmId).not.toHaveBeenCalled();
  });

  it("leaves everything as is when deletion fails or is dismissed", async () => {
    mockSelectedLlmId = small.id;
    mockDownloadStore.isDownloaded.mockReturnValue(true);
    mockDownloadStore.deleteModel.mockResolvedValue(false);
    const { getAllByText } = render(<IntelligenceSettingsScreen />);
    fireEvent.press(getAllByText("delete")[0]);
    mockShow.mock.calls[0][0].onSecondaryButtonTap();
    expect(mockHide).toHaveBeenCalled();
    await confirmDelete();
    expect(mockSetLlmId).not.toHaveBeenCalled();
    expect(mockShowGlobalTooltip).not.toHaveBeenCalled();
  });
});
