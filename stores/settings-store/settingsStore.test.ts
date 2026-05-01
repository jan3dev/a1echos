import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderHook } from "@testing-library/react-native";

import {
  AppTheme,
  ModelId,
  ModelType,
  SupportedLanguages,
  TranscriptionMode,
} from "@/models";

import {
  initializeSettingsStore,
  useHasSeenKeyboardPrompt,
  useIsIncognitoMode,
  useMarkKeyboardPromptSeen,
  useSelectedLanguage,
  useSelectedModelId,
  useSelectedModelType,
  useSelectedTheme,
  useSelectedTranscriptionMode,
  useSetLanguage,
  useSetModelId,
  useSetModelType,
  useSetSmartSplitEnabled,
  useSetTheme,
  useSettingsStore,
  useSetTranscriptionMode,
  useSmartSplitEnabled,
} from "./settingsStore";

jest.mock("@/utils", () => ({
  FeatureFlag: { settings: "SETTINGS" },
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

const initialState = {
  selectedTheme: AppTheme.AUTO,
  selectedModelType: ModelType.WHISPER_FILE,
  selectedModelId: ModelId.WHISPER_TINY,
  selectedTranscriptionMode: TranscriptionMode.FILE,
  modelModes: {},
  selectedLanguage: SupportedLanguages.defaultLanguage,
  isIncognitoMode: false,
  hasSeenIncognitoExplainer: false,
  smartSplitEnabled: true,
};

describe("settingsStore", () => {
  beforeEach(() => {
    useSettingsStore.setState(initialState);
  });

  describe("initial state", () => {
    it("has correct defaults", () => {
      const state = useSettingsStore.getState();
      expect(state.selectedTheme).toBe(AppTheme.AUTO);
      expect(state.selectedModelType).toBe(ModelType.WHISPER_FILE);
      expect(state.selectedLanguage).toEqual({ code: "en", name: "English" });
      expect(state.isIncognitoMode).toBe(false);
      expect(state.hasSeenIncognitoExplainer).toBe(false);
      expect(state.smartSplitEnabled).toBe(true);
    });
  });

  describe("initialize()", () => {
    // Storage key read order: THEME, MODEL_TYPE, MODEL_ID, TRANSCRIPTION_MODE, MODEL_MODES, LANGUAGE, INCOGNITO_MODE, INCOGNITO_EXPLAINER_SEEN
    it("loads all keys from storage in parallel", async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(AppTheme.DARK)
        .mockResolvedValueOnce(ModelType.WHISPER_REALTIME)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce("fr")
        .mockResolvedValueOnce("true")
        .mockResolvedValueOnce("true");

      await useSettingsStore.getState().initialize();
      const state = useSettingsStore.getState();

      expect(state.selectedTheme).toBe(AppTheme.DARK);
      expect(state.selectedModelType).toBe(ModelType.WHISPER_REALTIME);
      expect(state.selectedLanguage).toEqual({ code: "fr", name: "French" });
      expect(state.isIncognitoMode).toBe(true);
      expect(state.hasSeenIncognitoExplainer).toBe(true);
    });

    it("loads and validates per-model modes from storage", async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(ModelId.NEMO_PARAKEET_V3)
        .mockResolvedValueOnce(TranscriptionMode.REALTIME)
        .mockResolvedValueOnce(
          JSON.stringify({
            [ModelId.WHISPER_TINY]: TranscriptionMode.FILE,
            [ModelId.NEMO_PARAKEET_V3]: TranscriptionMode.REALTIME,
            junk_id: "bogus",
          }),
        )
        .mockResolvedValue(null);

      await useSettingsStore.getState().initialize();
      const { modelModes } = useSettingsStore.getState();

      expect(modelModes[ModelId.WHISPER_TINY]).toBe(TranscriptionMode.FILE);
      expect(modelModes[ModelId.NEMO_PARAKEET_V3]).toBe(
        TranscriptionMode.REALTIME,
      );
      expect(modelModes).not.toHaveProperty("junk_id");
    });

    it("ignores corrupt model_modes JSON and seeds selected model's mode", async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(ModelId.WHISPER_TINY)
        .mockResolvedValueOnce(TranscriptionMode.REALTIME)
        .mockResolvedValueOnce("{not json")
        .mockResolvedValue(null);

      await useSettingsStore.getState().initialize();
      expect(useSettingsStore.getState().modelModes).toEqual({
        [ModelId.WHISPER_TINY]: TranscriptionMode.REALTIME,
      });
    });

    it("falls back to defaults when storage returns null", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await useSettingsStore.getState().initialize();
      const state = useSettingsStore.getState();

      expect(state.selectedTheme).toBe(AppTheme.AUTO);
      expect(state.selectedModelType).toBe(ModelType.WHISPER_FILE);
      expect(state.selectedLanguage).toEqual({ code: "en", name: "English" });
      expect(state.isIncognitoMode).toBe(false);
      expect(state.hasSeenIncognitoExplainer).toBe(false);
    });

    it("falls back to default for invalid model type", async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce("invalid_model")
        .mockResolvedValue(null);

      await useSettingsStore.getState().initialize();
      expect(useSettingsStore.getState().selectedModelType).toBe(
        ModelType.WHISPER_FILE,
      );
    });

    it("falls back to default for invalid language code", async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce("zzz_invalid")
        .mockResolvedValue(null);

      await useSettingsStore.getState().initialize();
      expect(useSettingsStore.getState().selectedLanguage).toEqual({
        code: "en",
        name: "English",
      });
    });

    it('incognito mode is false for non-"true" string', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce("false")
        .mockResolvedValue(null);

      await useSettingsStore.getState().initialize();
      expect(useSettingsStore.getState().isIncognitoMode).toBe(false);
    });

    it("falls back to safe defaults on storage error", async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
        new Error("storage crash"),
      );

      // Set non-default state first
      useSettingsStore.setState({
        selectedTheme: AppTheme.DARK,
        isIncognitoMode: true,
      });

      await useSettingsStore.getState().initialize();
      const state = useSettingsStore.getState();

      expect(state.selectedTheme).toBe(AppTheme.AUTO);
      expect(state.selectedModelType).toBe(ModelType.WHISPER_FILE);
      expect(state.isIncognitoMode).toBe(false);
    });
  });

  describe("setTheme()", () => {
    it("optimistically updates and persists", async () => {
      await useSettingsStore.getState().setTheme(AppTheme.DARK);

      expect(useSettingsStore.getState().selectedTheme).toBe(AppTheme.DARK);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "selectedTheme",
        AppTheme.DARK,
      );
    });

    it("rolls back on persist failure", async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error("write fail"),
      );

      await expect(
        useSettingsStore.getState().setTheme(AppTheme.DARK),
      ).rejects.toThrow("write fail");

      expect(useSettingsStore.getState().selectedTheme).toBe(AppTheme.AUTO);
    });
  });

  describe("setModelType()", () => {
    it("optimistically updates and persists", async () => {
      await useSettingsStore
        .getState()
        .setModelType(ModelType.WHISPER_REALTIME);

      expect(useSettingsStore.getState().selectedModelType).toBe(
        ModelType.WHISPER_REALTIME,
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "selected_model_type",
        ModelType.WHISPER_REALTIME,
      );
    });

    it("rolls back on persist failure", async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error("write fail"),
      );

      await expect(
        useSettingsStore.getState().setModelType(ModelType.WHISPER_REALTIME),
      ).rejects.toThrow("write fail");

      expect(useSettingsStore.getState().selectedModelType).toBe(
        ModelType.WHISPER_FILE,
      );
    });
  });

  describe("setLanguage()", () => {
    const french = { code: "fr", name: "French" };

    it("optimistically updates and persists the language code", async () => {
      await useSettingsStore.getState().setLanguage(french);

      expect(useSettingsStore.getState().selectedLanguage).toEqual(french);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "spoken_language",
        "fr",
      );
    });

    it("rolls back on persist failure", async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error("write fail"),
      );

      await expect(
        useSettingsStore.getState().setLanguage(french),
      ).rejects.toThrow("write fail");

      expect(useSettingsStore.getState().selectedLanguage).toEqual({
        code: "en",
        name: "English",
      });
    });
  });

  describe("setIncognitoMode()", () => {
    it("optimistically updates and persists as string", async () => {
      await useSettingsStore.getState().setIncognitoMode(true);

      expect(useSettingsStore.getState().isIncognitoMode).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "incognito_mode",
        "true",
      );
    });

    it("rolls back on persist failure", async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error("write fail"),
      );

      await expect(
        useSettingsStore.getState().setIncognitoMode(true),
      ).rejects.toThrow("write fail");

      expect(useSettingsStore.getState().isIncognitoMode).toBe(false);
    });
  });

  describe("setSmartSplitEnabled()", () => {
    it("defaults to true in the store", () => {
      expect(useSettingsStore.getState().smartSplitEnabled).toBe(true);
    });

    it("persists explicit disable as the string 'false'", async () => {
      await useSettingsStore.getState().setSmartSplitEnabled(false);

      expect(useSettingsStore.getState().smartSplitEnabled).toBe(false);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "smart_split_enabled",
        "false",
      );
    });

    it("persists re-enable as the string 'true'", async () => {
      useSettingsStore.setState({ smartSplitEnabled: false });

      await useSettingsStore.getState().setSmartSplitEnabled(true);

      expect(useSettingsStore.getState().smartSplitEnabled).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "smart_split_enabled",
        "true",
      );
    });

    it("rolls back on persist failure", async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error("write fail"),
      );

      await useSettingsStore.getState().setSmartSplitEnabled(false);

      expect(useSettingsStore.getState().smartSplitEnabled).toBe(true);
    });

    it("initialize() treats only the string 'false' as opt-out", async () => {
      const keyOrder = [
        null, // THEME
        null, // MODEL_TYPE
        null, // MODEL_ID
        null, // TRANSCRIPTION_MODE
        null, // MODEL_MODES
        null, // LANGUAGE
        null, // INCOGNITO_MODE
        null, // INCOGNITO_EXPLAINER_SEEN
        "false", // SMART_SPLIT_ENABLED
      ];
      const mock = AsyncStorage.getItem as jest.Mock;
      for (const value of keyOrder) mock.mockResolvedValueOnce(value);

      await useSettingsStore.getState().initialize();
      expect(useSettingsStore.getState().smartSplitEnabled).toBe(false);
    });
  });

  describe("markIncognitoExplainerSeen()", () => {
    it("sets true and persists", async () => {
      await useSettingsStore.getState().markIncognitoExplainerSeen();

      expect(useSettingsStore.getState().hasSeenIncognitoExplainer).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "incognito_explainer_seen",
        "true",
      );
    });

    it("does NOT throw on persist failure (fire-and-forget)", async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error("write fail"),
      );

      await expect(
        useSettingsStore.getState().markIncognitoExplainerSeen(),
      ).resolves.toBeUndefined();

      // State is still set even though persist failed
      expect(useSettingsStore.getState().hasSeenIncognitoExplainer).toBe(true);
    });
  });

  describe("markKeyboardPromptSeen()", () => {
    it("sets true and persists", async () => {
      expect(useSettingsStore.getState().hasSeenKeyboardPrompt).toBe(false);

      await useSettingsStore.getState().markKeyboardPromptSeen();

      expect(useSettingsStore.getState().hasSeenKeyboardPrompt).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "keyboard_prompt_seen",
        "true",
      );
    });

    it("does NOT throw on persist failure (fire-and-forget)", async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error("write fail"),
      );

      await expect(
        useSettingsStore.getState().markKeyboardPromptSeen(),
      ).resolves.toBeUndefined();

      expect(useSettingsStore.getState().hasSeenKeyboardPrompt).toBe(true);
    });

    it("initialize() reads persisted true value", async () => {
      const AS: any = AsyncStorage;
      (AS.getItem as jest.Mock).mockImplementation(async (key: string) =>
        key === "keyboard_prompt_seen" ? "true" : null,
      );

      await useSettingsStore.getState().initialize();

      expect(useSettingsStore.getState().hasSeenKeyboardPrompt).toBe(true);
    });

    it("initializeSettingsStore() proxies to store initialize()", async () => {
      await expect(initializeSettingsStore()).resolves.toBeUndefined();
    });

    it("useHasSeenKeyboardPrompt selector reflects state", () => {
      useSettingsStore.setState({ hasSeenKeyboardPrompt: true });
      const { result } = renderHook(() => useHasSeenKeyboardPrompt());
      expect(result.current).toBe(true);
    });

    it("useMarkKeyboardPromptSeen returns the action", () => {
      const { result } = renderHook(() => useMarkKeyboardPromptSeen());
      expect(typeof result.current).toBe("function");
    });
  });

  describe("setModelId()", () => {
    it("optimistically updates and persists", async () => {
      await useSettingsStore.getState().setModelId(ModelId.NEMO_PARAKEET_V3);

      expect(useSettingsStore.getState().selectedModelId).toBe(
        ModelId.NEMO_PARAKEET_V3,
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "selected_model_id",
        ModelId.NEMO_PARAKEET_V3,
      );
    });

    it("resets language to default when current language not supported", async () => {
      useSettingsStore.setState({
        selectedLanguage: { code: "ja", name: "Japanese" },
      });
      await useSettingsStore.getState().setModelId(ModelId.NEMO_PARAKEET_V3);
      expect(useSettingsStore.getState().selectedLanguage.code).toBe("en");
    });

    it("keeps language when current language is supported", async () => {
      useSettingsStore.setState({
        selectedLanguage: { code: "es", name: "Spanish" },
      });
      await useSettingsStore.getState().setModelId(ModelId.NEMO_PARAKEET_V3);
      expect(useSettingsStore.getState().selectedLanguage.code).toBe("es");
    });

    it("rolls back on persist failure", async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error("write fail"),
      );
      const before = useSettingsStore.getState().selectedModelId;
      await expect(
        useSettingsStore.getState().setModelId(ModelId.NEMO_PARAKEET_V3),
      ).rejects.toThrow("write fail");
      expect(useSettingsStore.getState().selectedModelId).toBe(before);
    });
  });

  describe("setTranscriptionMode()", () => {
    it("optimistically updates and persists", async () => {
      await useSettingsStore
        .getState()
        .setTranscriptionMode(TranscriptionMode.REALTIME);
      expect(useSettingsStore.getState().selectedTranscriptionMode).toBe(
        TranscriptionMode.REALTIME,
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "selected_transcription_mode",
        TranscriptionMode.REALTIME,
      );
    });

    it("mirrors the change into modelModes for the selected model", async () => {
      await useSettingsStore
        .getState()
        .setTranscriptionMode(TranscriptionMode.REALTIME);
      expect(useSettingsStore.getState().modelModes[ModelId.WHISPER_TINY]).toBe(
        TranscriptionMode.REALTIME,
      );
    });

    it("rolls back on persist failure", async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error("write fail"),
      );
      await expect(
        useSettingsStore
          .getState()
          .setTranscriptionMode(TranscriptionMode.REALTIME),
      ).rejects.toThrow("write fail");
      expect(useSettingsStore.getState().selectedTranscriptionMode).toBe(
        TranscriptionMode.FILE,
      );
    });
  });

  describe("setModelMode()", () => {
    it("updates the per-model map for a non-active model", async () => {
      await useSettingsStore
        .getState()
        .setModelMode(ModelId.NEMO_PARAKEET_V3, TranscriptionMode.REALTIME);
      const state = useSettingsStore.getState();
      expect(state.modelModes[ModelId.NEMO_PARAKEET_V3]).toBe(
        TranscriptionMode.REALTIME,
      );
      // Global selected mode untouched
      expect(state.selectedTranscriptionMode).toBe(TranscriptionMode.FILE);
    });

    it("also updates global mode when the model is active", async () => {
      await useSettingsStore
        .getState()
        .setModelMode(ModelId.WHISPER_TINY, TranscriptionMode.REALTIME);
      const state = useSettingsStore.getState();
      expect(state.modelModes[ModelId.WHISPER_TINY]).toBe(
        TranscriptionMode.REALTIME,
      );
      expect(state.selectedTranscriptionMode).toBe(TranscriptionMode.REALTIME);
    });

    it("ignores modes unsupported by the target model", async () => {
      // QWEN3_ASR only supports FILE
      await useSettingsStore
        .getState()
        .setModelMode(ModelId.QWEN3_ASR, TranscriptionMode.REALTIME);
      expect(
        useSettingsStore.getState().modelModes[ModelId.QWEN3_ASR],
      ).toBeUndefined();
    });

    it("rolls back on persist failure", async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error("write fail"),
      );
      await expect(
        useSettingsStore
          .getState()
          .setModelMode(ModelId.WHISPER_TINY, TranscriptionMode.REALTIME),
      ).rejects.toThrow("write fail");
      expect(useSettingsStore.getState().selectedTranscriptionMode).toBe(
        TranscriptionMode.FILE,
      );
      expect(
        useSettingsStore.getState().modelModes[ModelId.WHISPER_TINY],
      ).toBeUndefined();
    });
  });

  describe("setModelId() applies saved per-model mode", () => {
    it("restores the target model's saved mode when switching", async () => {
      useSettingsStore.setState({
        modelModes: {
          [ModelId.NEMO_PARAKEET_V3]: TranscriptionMode.REALTIME,
        },
      });
      await useSettingsStore.getState().setModelId(ModelId.NEMO_PARAKEET_V3);
      expect(useSettingsStore.getState().selectedTranscriptionMode).toBe(
        TranscriptionMode.REALTIME,
      );
    });

    it("falls back to first supported mode when saved mode is unsupported", async () => {
      useSettingsStore.setState({
        selectedTranscriptionMode: TranscriptionMode.REALTIME,
      });
      await useSettingsStore.getState().setModelId(ModelId.QWEN3_ASR);
      expect(useSettingsStore.getState().selectedTranscriptionMode).toBe(
        TranscriptionMode.FILE,
      );
    });
  });

  describe("selector hooks", () => {
    it("useSelectedTheme returns AppTheme.AUTO by default", () => {
      const { result } = renderHook(() => useSelectedTheme());
      expect(result.current).toBe(AppTheme.AUTO);
    });

    it("useSelectedModelType returns ModelType.WHISPER_FILE by default", () => {
      const { result } = renderHook(() => useSelectedModelType());
      expect(result.current).toBe(ModelType.WHISPER_FILE);
    });

    it("useSelectedLanguage returns default language by default", () => {
      const { result } = renderHook(() => useSelectedLanguage());
      expect(result.current).toEqual(SupportedLanguages.defaultLanguage);
    });

    it("useIsIncognitoMode returns false by default", () => {
      const { result } = renderHook(() => useIsIncognitoMode());
      expect(result.current).toBe(false);
    });

    it("useSetLanguage returns a function", () => {
      const { result } = renderHook(() => useSetLanguage());
      expect(typeof result.current).toBe("function");
    });

    it("useSetModelType returns a function", () => {
      const { result } = renderHook(() => useSetModelType());
      expect(typeof result.current).toBe("function");
    });

    it("useSetTheme returns a function", () => {
      const { result } = renderHook(() => useSetTheme());
      expect(typeof result.current).toBe("function");
    });

    it("useSmartSplitEnabled returns true by default", () => {
      const { result } = renderHook(() => useSmartSplitEnabled());
      expect(result.current).toBe(true);
    });

    it("useSetSmartSplitEnabled returns a function", () => {
      const { result } = renderHook(() => useSetSmartSplitEnabled());
      expect(typeof result.current).toBe("function");
    });

    it("useSelectedModelId returns WHISPER_TINY by default", () => {
      const { result } = renderHook(() => useSelectedModelId());
      expect(result.current).toBe(ModelId.WHISPER_TINY);
    });

    it("useSelectedTranscriptionMode returns FILE by default", () => {
      const { result } = renderHook(() => useSelectedTranscriptionMode());
      expect(result.current).toBe(TranscriptionMode.FILE);
    });

    it("useSetModelId returns a function", () => {
      const { result } = renderHook(() => useSetModelId());
      expect(typeof result.current).toBe("function");
    });

    it("useSetTranscriptionMode returns a function", () => {
      const { result } = renderHook(() => useSetTranscriptionMode());
      expect(typeof result.current).toBe("function");
    });
  });
});
