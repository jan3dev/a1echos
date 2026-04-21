import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import {
  AppTheme,
  getModelInfo,
  getThemeByName,
  ModelId,
  ModelType,
  SpokenLanguage,
  SupportedLanguages,
  TranscriptionMode,
} from "@/models";
import { FeatureFlag, logError, logWarn } from "@/utils";

const STORAGE_KEYS = {
  THEME: "selectedTheme",
  MODEL_TYPE: "selected_model_type",
  MODEL_ID: "selected_model_id",
  TRANSCRIPTION_MODE: "selected_transcription_mode",
  MODEL_MODES: "model_modes",
  LANGUAGE: "spoken_language",
  INCOGNITO_MODE: "incognito_mode",
  INCOGNITO_EXPLAINER_SEEN: "incognito_explainer_seen",
};

type ModelModes = Partial<Record<ModelId, TranscriptionMode>>;

interface SettingsStore {
  selectedTheme: AppTheme;
  /** @deprecated Use selectedModelId + selectedTranscriptionMode */
  selectedModelType: ModelType;
  selectedModelId: ModelId;
  selectedTranscriptionMode: TranscriptionMode;
  /** Per-model transcription mode preference */
  modelModes: ModelModes;
  selectedLanguage: SpokenLanguage;
  isIncognitoMode: boolean;
  hasSeenIncognitoExplainer: boolean;

  initialize: () => Promise<void>;
  setTheme: (theme: AppTheme) => Promise<void>;
  /** @deprecated Use setModelId + setTranscriptionMode */
  setModelType: (modelType: ModelType) => Promise<void>;
  setModelId: (modelId: ModelId) => Promise<void>;
  setTranscriptionMode: (mode: TranscriptionMode) => Promise<void>;
  setModelMode: (modelId: ModelId, mode: TranscriptionMode) => Promise<void>;
  setLanguage: (language: SpokenLanguage) => Promise<void>;
  setIncognitoMode: (enabled: boolean) => Promise<void>;
  markIncognitoExplainerSeen: () => Promise<void>;
}

const getDefaultModelType = (): ModelType => {
  return ModelType.WHISPER_FILE;
};

/** Migrate old ModelType to new ModelId + TranscriptionMode */
const migrateModelType = (
  modelType: string,
): { modelId: ModelId; mode: TranscriptionMode } => {
  switch (modelType) {
    case ModelType.WHISPER_REALTIME:
      return {
        modelId: ModelId.WHISPER_TINY,
        mode: TranscriptionMode.REALTIME,
      };
    case ModelType.WHISPER_FILE:
    default:
      return { modelId: ModelId.WHISPER_TINY, mode: TranscriptionMode.FILE };
  }
};

const parseModelModes = (raw: string | null): ModelModes => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const validIds = Object.values(ModelId);
    const out: ModelModes = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!validIds.includes(key as ModelId)) continue;
      if (typeof value !== "string") continue;
      const info = getModelInfo(key as ModelId);
      if (!info.supportedModes.includes(value as TranscriptionMode)) continue;
      out[key as ModelId] = value as TranscriptionMode;
    }
    return out;
  } catch {
    return {};
  }
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  selectedTheme: AppTheme.AUTO,
  selectedModelType: getDefaultModelType(),
  selectedModelId: ModelId.WHISPER_TINY,
  selectedTranscriptionMode: TranscriptionMode.FILE,
  modelModes: {},
  selectedLanguage: SupportedLanguages.defaultLanguage,
  isIncognitoMode: false,
  hasSeenIncognitoExplainer: false,

  initialize: async () => {
    try {
      const [
        themeValue,
        modelTypeValue,
        modelIdValue,
        transcriptionModeValue,
        modelModesValue,
        languageValue,
        incognitoModeValue,
        incognitoExplainerValue,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.THEME),
        AsyncStorage.getItem(STORAGE_KEYS.MODEL_TYPE),
        AsyncStorage.getItem(STORAGE_KEYS.MODEL_ID),
        AsyncStorage.getItem(STORAGE_KEYS.TRANSCRIPTION_MODE),
        AsyncStorage.getItem(STORAGE_KEYS.MODEL_MODES),
        AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE),
        AsyncStorage.getItem(STORAGE_KEYS.INCOGNITO_MODE),
        AsyncStorage.getItem(STORAGE_KEYS.INCOGNITO_EXPLAINER_SEEN),
      ]);

      const selectedTheme = themeValue
        ? getThemeByName(themeValue)
        : AppTheme.AUTO;

      // Legacy model type (kept for backward compat)
      const selectedModelType = modelTypeValue
        ? Object.values(ModelType).includes(modelTypeValue as ModelType)
          ? (modelTypeValue as ModelType)
          : getDefaultModelType()
        : getDefaultModelType();

      // New model settings: migrate from old format if new keys not set
      let selectedModelId: ModelId;
      let selectedTranscriptionMode: TranscriptionMode;

      if (
        modelIdValue &&
        Object.values(ModelId).includes(modelIdValue as ModelId)
      ) {
        selectedModelId = modelIdValue as ModelId;
        selectedTranscriptionMode =
          transcriptionModeValue &&
          Object.values(TranscriptionMode).includes(
            transcriptionModeValue as TranscriptionMode,
          )
            ? (transcriptionModeValue as TranscriptionMode)
            : TranscriptionMode.FILE;
      } else {
        // Migrate from old ModelType
        const migrated = migrateModelType(selectedModelType);
        selectedModelId = migrated.modelId;
        selectedTranscriptionMode = migrated.mode;
        // Persist migration
        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.MODEL_ID, selectedModelId),
          AsyncStorage.setItem(
            STORAGE_KEYS.TRANSCRIPTION_MODE,
            selectedTranscriptionMode,
          ),
        ]);
      }

      const storedModelModes = parseModelModes(modelModesValue);
      // Seed the selected model's preference if absent (covers legacy migration)
      const modelModes: ModelModes = {
        [selectedModelId]: selectedTranscriptionMode,
        ...storedModelModes,
      };

      const selectedLanguage = languageValue
        ? (SupportedLanguages.findByCode(languageValue) ??
          SupportedLanguages.defaultLanguage)
        : SupportedLanguages.defaultLanguage;
      const isIncognitoMode = incognitoModeValue === "true";
      const hasSeenIncognitoExplainer = incognitoExplainerValue === "true";

      set({
        selectedTheme,
        selectedModelType,
        selectedModelId,
        selectedTranscriptionMode,
        modelModes,
        selectedLanguage,
        isIncognitoMode,
        hasSeenIncognitoExplainer,
      });
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.settings,
        message: "Failed to load settings",
      });
      set({
        selectedTheme: AppTheme.AUTO,
        selectedModelType: getDefaultModelType(),
        selectedModelId: ModelId.WHISPER_TINY,
        selectedTranscriptionMode: TranscriptionMode.FILE,
        modelModes: {},
        selectedLanguage: SupportedLanguages.defaultLanguage,
        isIncognitoMode: false,
        hasSeenIncognitoExplainer: false,
      });
    }
  },

  setTheme: async (theme: AppTheme) => {
    const previousTheme = get().selectedTheme;
    set({ selectedTheme: theme });
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.settings,
        message: "Failed to save theme",
      });
      set({ selectedTheme: previousTheme });
      throw error;
    }
  },

  setModelType: async (modelType: ModelType) => {
    const previousModelType = get().selectedModelType;
    set({ selectedModelType: modelType });
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.MODEL_TYPE, modelType);
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.settings,
        message: "Failed to save model type",
      });
      set({ selectedModelType: previousModelType });
      throw error;
    }
  },

  setModelId: async (modelId: ModelId) => {
    const state = get();
    const prevId = state.selectedModelId;
    const prevMode = state.selectedTranscriptionMode;
    const modelInfo = getModelInfo(modelId);

    // Prefer this model's saved mode; else keep current mode if supported;
    // else fall back to the first mode the model supports.
    const savedMode = state.modelModes[modelId];
    const nextMode =
      savedMode && modelInfo.supportedModes.includes(savedMode)
        ? savedMode
        : modelInfo.supportedModes.includes(prevMode)
          ? prevMode
          : modelInfo.supportedModes[0];

    set({ selectedModelId: modelId, selectedTranscriptionMode: nextMode });
    try {
      const writes: Promise<void>[] = [
        AsyncStorage.setItem(STORAGE_KEYS.MODEL_ID, modelId),
      ];
      if (nextMode !== prevMode) {
        writes.push(
          AsyncStorage.setItem(STORAGE_KEYS.TRANSCRIPTION_MODE, nextMode),
        );
      }
      await Promise.all(writes);

      const currentLang = get().selectedLanguage;
      if (
        modelInfo.supportedLanguageCodes &&
        !SupportedLanguages.isSupported(
          currentLang.code,
          modelInfo.supportedLanguageCodes,
        )
      ) {
        await get().setLanguage(SupportedLanguages.defaultLanguage);
      }
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.settings,
        message: "Failed to save model id",
      });
      set({ selectedModelId: prevId, selectedTranscriptionMode: prevMode });
      throw error;
    }
  },

  setTranscriptionMode: async (mode: TranscriptionMode) => {
    await get().setModelMode(get().selectedModelId, mode);
  },

  setModelMode: async (modelId: ModelId, mode: TranscriptionMode) => {
    const state = get();
    const info = getModelInfo(modelId);
    if (!info.supportedModes.includes(mode)) {
      logWarn(`Ignoring unsupported mode ${mode} for model ${modelId}`, {
        flag: FeatureFlag.settings,
      });
      return;
    }
    if (state.modelModes[modelId] === mode) return;

    const prevMap = state.modelModes;
    const prevMode = state.selectedTranscriptionMode;
    const nextMap = { ...prevMap, [modelId]: mode };
    const isActive = modelId === state.selectedModelId;

    set({
      modelModes: nextMap,
      selectedTranscriptionMode: isActive ? mode : prevMode,
    });
    try {
      const writes: Promise<void>[] = [
        AsyncStorage.setItem(STORAGE_KEYS.MODEL_MODES, JSON.stringify(nextMap)),
      ];
      if (isActive) {
        writes.push(
          AsyncStorage.setItem(STORAGE_KEYS.TRANSCRIPTION_MODE, mode),
        );
      }
      await Promise.all(writes);
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.settings,
        message: "Failed to save model mode",
      });
      set({ modelModes: prevMap, selectedTranscriptionMode: prevMode });
      throw error;
    }
  },

  setLanguage: async (language: SpokenLanguage) => {
    const previousLanguage = get().selectedLanguage;
    set({ selectedLanguage: language });
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, language.code);
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.settings,
        message: "Failed to save language",
      });
      set({ selectedLanguage: previousLanguage });
      throw error;
    }
  },

  setIncognitoMode: async (enabled: boolean) => {
    const previousValue = get().isIncognitoMode;
    set({ isIncognitoMode: enabled });
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.INCOGNITO_MODE,
        enabled.toString(),
      );
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.settings,
        message: "Failed to save incognito mode",
      });
      set({ isIncognitoMode: previousValue });
      throw error;
    }
  },

  markIncognitoExplainerSeen: async () => {
    set({ hasSeenIncognitoExplainer: true });
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.INCOGNITO_EXPLAINER_SEEN, "true");
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.settings,
        message: "Failed to save incognito explainer flag",
      });
    }
  },
}));

export const useSelectedTheme = () => useSettingsStore((s) => s.selectedTheme);
export const useSelectedModelType = () =>
  useSettingsStore((s) => s.selectedModelType);
export const useSelectedModelId = () =>
  useSettingsStore((s) => s.selectedModelId);
export const useSelectedTranscriptionMode = () =>
  useSettingsStore((s) => s.selectedTranscriptionMode);
export const useModelModes = () => useSettingsStore((s) => s.modelModes);
export const useSelectedLanguage = () =>
  useSettingsStore((s) => s.selectedLanguage);
export const useIsIncognitoMode = () =>
  useSettingsStore((s) => s.isIncognitoMode);
export const useSetLanguage = () => useSettingsStore((s) => s.setLanguage);
export const useSetModelType = () => useSettingsStore((s) => s.setModelType);
export const useSetModelId = () => useSettingsStore((s) => s.setModelId);
export const useSetTranscriptionMode = () =>
  useSettingsStore((s) => s.setTranscriptionMode);
export const useSetModelMode = () => useSettingsStore((s) => s.setModelMode);
export const useSetTheme = () => useSettingsStore((s) => s.setTheme);
export const initializeSettingsStore = async (): Promise<void> => {
  await useSettingsStore.getState().initialize();
};

export default useSettingsStore;
