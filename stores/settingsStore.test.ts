import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderHook } from "@testing-library/react-native";

import { AppTheme, ModelType, SupportedLanguages } from "@/models";

import {
  useSettingsStore,
  useSelectedTheme,
  useSelectedModelType,
  useSelectedLanguage,
  useIsIncognitoMode,
  useIsHapticsEnabled,
  useIsSoundsEnabled,
  useSetHapticsEnabled,
  useSetLanguage,
  useSetModelType,
  useSetSoundsEnabled,
  useSetTheme,
} from "./settingsStore";

jest.mock("@/utils", () => ({
  FeatureFlag: { settings: "SETTINGS" },
  logError: jest.fn(),
}));

const initialState = {
  selectedTheme: AppTheme.AUTO,
  selectedModelType: ModelType.WHISPER_FILE,
  selectedLanguage: SupportedLanguages.defaultLanguage,
  isIncognitoMode: false,
  hasSeenIncognitoExplainer: false,
  isHapticsEnabled: true,
  isSoundsEnabled: true,
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
      expect(state.isHapticsEnabled).toBe(true);
      expect(state.isSoundsEnabled).toBe(true);
    });
  });

  describe("initialize()", () => {
    it("loads all 7 keys from storage in parallel", async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(AppTheme.DARK)
        .mockResolvedValueOnce(ModelType.WHISPER_REALTIME)
        .mockResolvedValueOnce("fr")
        .mockResolvedValueOnce("true")
        .mockResolvedValueOnce("true")
        .mockResolvedValueOnce("false")
        .mockResolvedValueOnce("false");

      await useSettingsStore.getState().initialize();
      const state = useSettingsStore.getState();

      expect(state.selectedTheme).toBe(AppTheme.DARK);
      expect(state.selectedModelType).toBe(ModelType.WHISPER_REALTIME);
      expect(state.selectedLanguage).toEqual({ code: "fr", name: "French" });
      expect(state.isIncognitoMode).toBe(true);
      expect(state.hasSeenIncognitoExplainer).toBe(true);
      expect(state.isHapticsEnabled).toBe(false);
      expect(state.isSoundsEnabled).toBe(false);
    });

    it("falls back to defaults when storage returns null", async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await useSettingsStore.getState().initialize();
      const state = useSettingsStore.getState();

      expect(state.selectedTheme).toBe(AppTheme.AUTO);
      expect(state.selectedModelType).toBe(ModelType.WHISPER_FILE);
      expect(state.selectedLanguage).toEqual({ code: "en", name: "English" });
      expect(state.isIncognitoMode).toBe(false);
      expect(state.hasSeenIncognitoExplainer).toBe(false);
      expect(state.isHapticsEnabled).toBe(true);
      expect(state.isSoundsEnabled).toBe(true);
    });

    it("falls back to default for invalid model type", async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce("invalid_model")
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await useSettingsStore.getState().initialize();
      expect(useSettingsStore.getState().selectedModelType).toBe(
        ModelType.WHISPER_FILE,
      );
    });

    it("falls back to default for invalid language code", async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce("zzz_invalid")
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

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
        .mockResolvedValueOnce("false")
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await useSettingsStore.getState().initialize();
      expect(useSettingsStore.getState().isIncognitoMode).toBe(false);
    });

    it("haptics/sounds: null → default true, 'true' → true, anything else → false", async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce("true")
        .mockResolvedValueOnce("anything-else");

      await useSettingsStore.getState().initialize();
      const state = useSettingsStore.getState();

      expect(state.isHapticsEnabled).toBe(true);
      expect(state.isSoundsEnabled).toBe(false);
    });

    it("falls back to safe defaults on storage error", async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
        new Error("storage crash"),
      );

      // Set non-default state first
      useSettingsStore.setState({
        selectedTheme: AppTheme.DARK,
        isIncognitoMode: true,
        isHapticsEnabled: false,
        isSoundsEnabled: false,
      });

      await useSettingsStore.getState().initialize();
      const state = useSettingsStore.getState();

      expect(state.selectedTheme).toBe(AppTheme.AUTO);
      expect(state.selectedModelType).toBe(ModelType.WHISPER_FILE);
      expect(state.isIncognitoMode).toBe(false);
      expect(state.isHapticsEnabled).toBe(true);
      expect(state.isSoundsEnabled).toBe(true);
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

  describe("setHapticsEnabled()", () => {
    it("optimistically updates and persists as string", async () => {
      await useSettingsStore.getState().setHapticsEnabled(false);

      expect(useSettingsStore.getState().isHapticsEnabled).toBe(false);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "haptics_enabled",
        "false",
      );
    });

    it("rolls back on persist failure", async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error("write fail"),
      );

      await expect(
        useSettingsStore.getState().setHapticsEnabled(false),
      ).rejects.toThrow("write fail");

      expect(useSettingsStore.getState().isHapticsEnabled).toBe(true);
    });
  });

  describe("setSoundsEnabled()", () => {
    it("optimistically updates and persists as string", async () => {
      await useSettingsStore.getState().setSoundsEnabled(false);

      expect(useSettingsStore.getState().isSoundsEnabled).toBe(false);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "sounds_enabled",
        "false",
      );
    });

    it("rolls back on persist failure", async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error("write fail"),
      );

      await expect(
        useSettingsStore.getState().setSoundsEnabled(false),
      ).rejects.toThrow("write fail");

      expect(useSettingsStore.getState().isSoundsEnabled).toBe(true);
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

    it("useIsHapticsEnabled returns true by default", () => {
      const { result } = renderHook(() => useIsHapticsEnabled());
      expect(result.current).toBe(true);
    });

    it("useIsSoundsEnabled returns true by default", () => {
      const { result } = renderHook(() => useIsSoundsEnabled());
      expect(result.current).toBe(true);
    });

    it("useSetHapticsEnabled returns a function", () => {
      const { result } = renderHook(() => useSetHapticsEnabled());
      expect(typeof result.current).toBe("function");
    });

    it("useSetSoundsEnabled returns a function", () => {
      const { result } = renderHook(() => useSetSoundsEnabled());
      expect(typeof result.current).toBe("function");
    });
  });
});
