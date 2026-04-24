/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

import ModelSettingsScreen from "./model";

// --- Mocks ---

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

const mockSetModelId = jest.fn();
const mockSetModelMode = jest.fn();
const mockShowGlobalTooltip = jest.fn();
const mockCheckDiskSpace = jest.fn();

jest.mock("@/services/ModelDownloadService", () => ({
  modelDownloadService: {
    checkDiskSpace: (...args: unknown[]) => mockCheckDiskSpace(...args),
  },
}));

const mockDownloadStore = {
  getProgress: jest.fn() as jest.Mock,
  isDownloaded: jest.fn() as jest.Mock,
  startDownload: jest.fn() as jest.Mock,
  cancelDownload: jest.fn(),
  deleteModel: jest.fn() as jest.Mock,
};

jest.mock("@/theme", () => ({
  useTheme: jest.fn(() => ({
    theme: {
      colors: {
        surfaceBackground: "#fff",
        surfacePrimary: "#fff",
        surfaceBorderPrimary: "#ccc",
        textPrimary: "#000",
        textSecondary: "#666",
      },
    },
  })),
}));

jest.mock("@/hooks", () => ({
  useLocalization: jest.fn(() => ({
    loc: new Proxy(
      {},
      {
        get: (_, p: string) => {
          if (typeof p !== "string") return undefined;
          if (p === "insufficientSpace") {
            return (required: string, available: string) =>
              `insufficientSpace:${required},${available}`;
          }
          return p;
        },
      },
    ),
  })),
}));

const whisperModel = {
  id: "whisper_tiny",
  name: "Whisper Tiny",
  description: "Fast",
  sizeBytes: 100_000_000,
  supportedModes: ["file", "realtime"],
  isBundled: true,
  languages: 99,
};

const parakeetModel = {
  id: "nemo_parakeet_v3",
  name: "Parakeet V3",
  description: "High accuracy",
  sizeBytes: 670_000_000,
  supportedModes: ["file", "realtime"],
  isBundled: false,
  languages: 25,
  supportedLanguageCodes: ["en", "es"],
};

jest.mock("@/models", () => ({
  ModelId: {
    WHISPER_TINY: "whisper_tiny",
    NEMO_PARAKEET_V3: "nemo_parakeet_v3",
  },
  TranscriptionMode: { FILE: "file", REALTIME: "realtime" },
  getAllModels: jest.fn(() => [whisperModel, parakeetModel]),
  getModelInfo: jest.fn((id: string) =>
    id === "whisper_tiny" ? whisperModel : parakeetModel,
  ),
}));

jest.mock("@/stores", () => ({
  useModelDownloadStore: jest.fn(() => mockDownloadStore),
  useSelectedModelId: jest.fn(() => "whisper_tiny"),
  useModelModes: jest.fn(() => ({ whisper_tiny: "file" })),
  useSettingsStore: jest.fn((selector: any) =>
    selector({
      setModelId: mockSetModelId,
      setModelMode: mockSetModelMode,
    }),
  ),
  useShowGlobalTooltip: jest.fn(() => mockShowGlobalTooltip),
}));

jest.mock("@/utils", () => ({
  logError: jest.fn(),
  FeatureFlag: { settings: "settings" },
  iosPressed: jest.fn(() => 1),
  logWarn: jest.fn(),
  formatBytes: jest.fn(
    (bytes: number) => `${Math.round(bytes / 1_000_000)} MB`,
  ),
}));

jest.mock("@/components/ui/toast/Toast", () => ({
  Toast: () => null,
}));

const mockShow = jest.fn();
const mockHide = jest.fn();
jest.mock("@/components/ui/toast/useToast", () => ({
  useToast: () => ({ show: mockShow, hide: mockHide, toastState: {} }),
}));

jest.mock("@/components", () => {
  const { View, Text, TouchableOpacity } = require("react-native");
  const { TestID: TID } = require("@/constants");
  return {
    ModelCard: ({
      name,
      testID,
      supportedModes,
      onSelect,
      onDownload,
      onDelete,
      onRetry,
      onCancelDownload,
      onLanguagesPress,
      onSelectMode,
    }: any) => (
      <View testID={testID}>
        <Text>{String(name)}</Text>
        <TouchableOpacity testID={`${testID}-select`} onPress={onSelect}>
          <Text>select</Text>
        </TouchableOpacity>
        <TouchableOpacity testID={`${testID}-download`} onPress={onDownload}>
          <Text>download</Text>
        </TouchableOpacity>
        <TouchableOpacity testID={`${testID}-delete`} onPress={onDelete}>
          <Text>delete</Text>
        </TouchableOpacity>
        <TouchableOpacity testID={`${testID}-retry`} onPress={onRetry}>
          <Text>retry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={`${testID}-cancel`}
          onPress={onCancelDownload}
        >
          <Text>cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={`${testID}-languages`}
          onPress={onLanguagesPress}
        >
          <Text>languages</Text>
        </TouchableOpacity>
        {supportedModes?.map((m: string) => (
          <TouchableOpacity
            key={m}
            testID={`${testID}-mode-${m}`}
            onPress={() => onSelectMode?.(m)}
          >
            <Text>mode-{m}</Text>
          </TouchableOpacity>
        ))}
      </View>
    ),
    Screen: ({ children }: any) => <View>{children}</View>,
    Text: ({ children }: any) => <Text>{String(children)}</Text>,
    TopAppBar: ({ title }: any) => (
      <View testID={TID.TopAppBar}>
        <Text>{String(title)}</Text>
      </View>
    ),
  };
});

describe("ModelSettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDownloadStore.getProgress.mockReturnValue(undefined);
    mockDownloadStore.isDownloaded.mockReturnValue(false);
    mockDownloadStore.startDownload.mockResolvedValue(true);
    mockDownloadStore.deleteModel.mockResolvedValue(true);
    mockSetModelId.mockResolvedValue(undefined);
    mockSetModelMode.mockResolvedValue(undefined);
    mockCheckDiskSpace.mockResolvedValue({
      available: 10_000_000_000,
      required: 670_000_000,
      sufficient: true,
    });
  });

  it("renders TopAppBar and section headers", () => {
    const { getByText, getByTestId } = render(<ModelSettingsScreen />);
    expect(getByTestId("top-app-bar")).toBeTruthy();
    expect(getByText("title")).toBeTruthy();
    expect(getByText("sectionDownloaded")).toBeTruthy();
    expect(getByText("sectionAvailable")).toBeTruthy();
  });

  it("places bundled model in downloaded section and non-downloaded in available", () => {
    const { getByTestId } = render(<ModelSettingsScreen />);
    expect(getByTestId("model-card-whisper_tiny")).toBeTruthy();
    expect(getByTestId("model-card-nemo_parakeet_v3")).toBeTruthy();
  });

  it("selecting the same model is a no-op", () => {
    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId("model-card-whisper_tiny-select"));
    expect(mockSetModelId).not.toHaveBeenCalled();
  });

  it("selecting a downloaded non-selected model calls setModelId", async () => {
    mockDownloadStore.isDownloaded.mockImplementation(
      (id: string) => id === "nemo_parakeet_v3",
    );
    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId("model-card-nemo_parakeet_v3-select"));
    await waitFor(() => {
      expect(mockSetModelId).toHaveBeenCalledWith("nemo_parakeet_v3");
    });
  });

  it("tapping select on a not-downloaded model triggers download flow", async () => {
    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId("model-card-nemo_parakeet_v3-select"));
    await waitFor(() => {
      expect(mockDownloadStore.startDownload).toHaveBeenCalledWith(
        "nemo_parakeet_v3",
      );
    });
  });

  it("download success auto-selects the model", async () => {
    mockDownloadStore.startDownload.mockResolvedValue(true);
    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId("model-card-nemo_parakeet_v3-download"));
    await waitFor(() => {
      expect(mockSetModelId).toHaveBeenCalledWith("nemo_parakeet_v3");
    });
  });

  it("download failure logs error when auto-select throws", async () => {
    const { logError } = require("@/utils");
    mockDownloadStore.startDownload.mockResolvedValue(true);
    mockSetModelId.mockRejectedValueOnce(new Error("nope"));
    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId("model-card-nemo_parakeet_v3-download"));
    await waitFor(() => {
      expect(logError).toHaveBeenCalled();
    });
  });

  it("shows a warning tooltip and skips startDownload when disk space is insufficient", async () => {
    mockCheckDiskSpace.mockResolvedValueOnce({
      available: 50_000_000,
      required: 670_000_000,
      sufficient: false,
    });
    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId("model-card-nemo_parakeet_v3-download"));
    await waitFor(() => {
      expect(mockShowGlobalTooltip).toHaveBeenCalledWith(
        expect.stringContaining("insufficientSpace"),
        "warning",
        5000,
      );
    });
    expect(mockDownloadStore.startDownload).not.toHaveBeenCalled();
  });

  it("skips download when model is currently downloading", async () => {
    mockDownloadStore.getProgress.mockReturnValue({
      modelId: "nemo_parakeet_v3",
      status: "downloading",
      progress: 0.5,
      downloadedBytes: 0,
      totalBytes: 0,
      currentFileIndex: 0,
      totalFiles: 1,
    });
    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId("model-card-nemo_parakeet_v3-download"));
    await waitFor(() => {
      expect(mockDownloadStore.startDownload).not.toHaveBeenCalled();
    });
  });

  it("cancel tap calls downloadStore.cancelDownload", () => {
    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId("model-card-nemo_parakeet_v3-cancel"));
    expect(mockDownloadStore.cancelDownload).toHaveBeenCalledWith(
      "nemo_parakeet_v3",
    );
  });

  it("retry tap calls startDownload", async () => {
    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId("model-card-nemo_parakeet_v3-retry"));
    await waitFor(() => {
      expect(mockDownloadStore.startDownload).toHaveBeenCalledWith(
        "nemo_parakeet_v3",
      );
    });
  });

  it("delete flow shows confirm toast and triggers global tooltip on success", async () => {
    mockDownloadStore.isDownloaded.mockReturnValue(true);
    mockShow.mockImplementation(async (opts: any) => {
      await opts.onPrimaryButtonTap();
    });
    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId("model-card-nemo_parakeet_v3-delete"));
    await waitFor(() => {
      expect(mockDownloadStore.deleteModel).toHaveBeenCalledWith(
        "nemo_parakeet_v3",
      );
      expect(mockShowGlobalTooltip).toHaveBeenCalledWith(
        "deletedToast",
        "normal",
        3000,
      );
    });
  });

  it("delete of currently-selected non-bundled model falls back to WHISPER_TINY", async () => {
    const { useSelectedModelId } = require("@/stores");
    useSelectedModelId.mockReturnValueOnce("nemo_parakeet_v3");
    mockDownloadStore.isDownloaded.mockReturnValue(true);
    mockShow.mockImplementation(async (opts: any) => {
      await opts.onPrimaryButtonTap();
    });
    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId("model-card-nemo_parakeet_v3-delete"));
    await waitFor(() => {
      expect(mockSetModelId).toHaveBeenCalledWith("whisper_tiny");
    });
  });

  it("delete cancel button hides the toast", () => {
    const { getByTestId } = render(<ModelSettingsScreen />);
    mockShow.mockImplementation((opts: any) => {
      opts.onSecondaryButtonTap();
    });
    fireEvent.press(getByTestId("model-card-nemo_parakeet_v3-delete"));
    expect(mockHide).toHaveBeenCalled();
  });

  it("languages tap navigates to model-languages route", () => {
    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId("model-card-whisper_tiny-languages"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/settings/model-languages",
      params: { modelId: "whisper_tiny" },
    });
  });

  it("tapping a mode chip on the selected card calls setModelMode with that model id", async () => {
    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId("model-card-whisper_tiny-mode-realtime"));
    await waitFor(() => {
      expect(mockSetModelMode).toHaveBeenCalledWith("whisper_tiny", "realtime");
    });
    expect(mockSetModelId).not.toHaveBeenCalled();
  });

  it("tapping a mode chip on a non-selected card updates only that model's mode", async () => {
    mockDownloadStore.isDownloaded.mockReturnValue(true);
    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId("model-card-nemo_parakeet_v3-mode-realtime"));
    await waitFor(() => {
      expect(mockSetModelMode).toHaveBeenCalledWith(
        "nemo_parakeet_v3",
        "realtime",
      );
    });
    expect(mockSetModelId).not.toHaveBeenCalled();
  });

  it("logs error when setModelMode fails", async () => {
    const { logError } = require("@/utils");
    mockSetModelMode.mockRejectedValue(new Error("mode error"));
    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId("model-card-whisper_tiny-mode-realtime"));
    await waitFor(() => {
      expect(logError).toHaveBeenCalled();
    });
  });

  it("logs error when setModelId fails", async () => {
    mockDownloadStore.isDownloaded.mockImplementation(
      (id: string) => id === "nemo_parakeet_v3",
    );
    const { logError } = require("@/utils");
    mockSetModelId.mockRejectedValue(new Error("fail"));
    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId("model-card-nemo_parakeet_v3-select"));
    await waitFor(() => {
      expect(logError).toHaveBeenCalled();
    });
  });

  it("ignores taps while saving", async () => {
    mockDownloadStore.isDownloaded.mockImplementation(
      (id: string) => id === "nemo_parakeet_v3",
    );
    let resolveSet: () => void;
    mockSetModelId.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSet = resolve;
        }),
    );
    const { getByTestId } = render(<ModelSettingsScreen />);
    fireEvent.press(getByTestId("model-card-nemo_parakeet_v3-select"));
    fireEvent.press(getByTestId("model-card-nemo_parakeet_v3-select"));
    await waitFor(() => {
      expect(mockSetModelId).toHaveBeenCalledTimes(1);
    });
    resolveSet!();
    await waitFor(() => {
      expect(mockSetModelId).toHaveBeenCalledTimes(1);
    });
  });
});
