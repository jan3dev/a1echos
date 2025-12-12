import {
  AppTheme,
  getThemeByName,
  ModelType,
  SpokenLanguage,
  SupportedLanguages,
} from '@/models';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEYS = {
  THEME: 'selectedTheme',
  MODEL_TYPE: 'selected_model_type',
  LANGUAGE: 'spoken_language',
  INCOGNITO_MODE: 'incognito_mode',
  INCOGNITO_EXPLAINER_SEEN: 'incognito_explainer_seen',
};

interface SettingsStore {
  selectedTheme: AppTheme;
  selectedModelType: ModelType;
  selectedLanguage: SpokenLanguage;
  isIncognitoMode: boolean;
  hasSeenIncognitoExplainer: boolean;

  initialize: () => Promise<void>;
  setTheme: (theme: AppTheme) => Promise<void>;
  setModelType: (modelType: ModelType) => Promise<void>;
  setLanguage: (language: SpokenLanguage) => Promise<void>;
  setIncognitoMode: (enabled: boolean) => Promise<void>;
  markIncognitoExplainerSeen: () => Promise<void>;
}

const getDefaultModelType = (): ModelType => {
  return ModelType.WHISPER_REALTIME;
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  selectedTheme: AppTheme.AUTO,
  selectedModelType: getDefaultModelType(),
  selectedLanguage: SupportedLanguages.defaultLanguage,
  isIncognitoMode: false,
  hasSeenIncognitoExplainer: false,

  initialize: async () => {
    try {
      const [
        themeValue,
        modelTypeValue,
        languageValue,
        incognitoModeValue,
        incognitoExplainerValue,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.THEME),
        AsyncStorage.getItem(STORAGE_KEYS.MODEL_TYPE),
        AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE),
        AsyncStorage.getItem(STORAGE_KEYS.INCOGNITO_MODE),
        AsyncStorage.getItem(STORAGE_KEYS.INCOGNITO_EXPLAINER_SEEN),
      ]);

      const selectedTheme = themeValue
        ? getThemeByName(themeValue)
        : AppTheme.AUTO;
      const selectedModelType = modelTypeValue
        ? Object.values(ModelType).includes(modelTypeValue as ModelType)
          ? (modelTypeValue as ModelType)
          : getDefaultModelType()
        : getDefaultModelType();
      const selectedLanguage = languageValue
        ? SupportedLanguages.findByCode(languageValue) ??
          SupportedLanguages.defaultLanguage
        : SupportedLanguages.defaultLanguage;
      const isIncognitoMode = incognitoModeValue === 'true';
      const hasSeenIncognitoExplainer = incognitoExplainerValue === 'true';

      set({
        selectedTheme,
        selectedModelType,
        selectedLanguage,
        isIncognitoMode,
        hasSeenIncognitoExplainer,
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      set({
        selectedTheme: AppTheme.AUTO,
        selectedModelType: getDefaultModelType(),
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
      console.error('Failed to save theme:', error);
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
      console.error('Failed to save model type:', error);
      set({ selectedModelType: previousModelType });
      throw error;
    }
  },

  setLanguage: async (language: SpokenLanguage) => {
    const previousLanguage = get().selectedLanguage;
    set({ selectedLanguage: language });
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, language.code);
    } catch (error) {
      console.error('Failed to save language:', error);
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
        enabled.toString()
      );
    } catch (error) {
      console.error('Failed to save incognito mode:', error);
      set({ isIncognitoMode: previousValue });
      throw error;
    }
  },

  markIncognitoExplainerSeen: async () => {
    set({ hasSeenIncognitoExplainer: true });
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.INCOGNITO_EXPLAINER_SEEN, 'true');
    } catch (error) {
      console.error('Failed to save incognito explainer flag:', error);
    }
  },
}));

export const useSelectedTheme = () => useSettingsStore((s) => s.selectedTheme);
export const useSelectedModelType = () =>
  useSettingsStore((s) => s.selectedModelType);
export const useSelectedLanguage = () =>
  useSettingsStore((s) => s.selectedLanguage);
export const useIsIncognitoMode = () =>
  useSettingsStore((s) => s.isIncognitoMode);
export const useSetLanguage = () => useSettingsStore((s) => s.setLanguage);
export const useSetModelType = () => useSettingsStore((s) => s.setModelType);
export const useSetTheme = () => useSettingsStore((s) => s.setTheme);
export const initializeSettingsStore = async (): Promise<void> => {
  await useSettingsStore.getState().initialize();
};

export default useSettingsStore;
