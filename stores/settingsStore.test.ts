import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppTheme, ModelType, SupportedLanguages } from '@/models';

import { useSettingsStore } from './settingsStore';

jest.mock('@/utils', () => ({
  FeatureFlag: { settings: 'SETTINGS' },
  logError: jest.fn(),
}));

const initialState = {
  selectedTheme: AppTheme.AUTO,
  selectedModelType: ModelType.WHISPER_FILE,
  selectedLanguage: SupportedLanguages.defaultLanguage,
  isIncognitoMode: false,
  hasSeenIncognitoExplainer: false,
};

describe('settingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState(initialState);
  });

  describe('initial state', () => {
    it('has correct defaults', () => {
      const state = useSettingsStore.getState();
      expect(state.selectedTheme).toBe(AppTheme.AUTO);
      expect(state.selectedModelType).toBe(ModelType.WHISPER_FILE);
      expect(state.selectedLanguage).toEqual({ code: 'en', name: 'English' });
      expect(state.isIncognitoMode).toBe(false);
      expect(state.hasSeenIncognitoExplainer).toBe(false);
    });
  });

  describe('initialize()', () => {
    it('loads all 5 keys from storage in parallel', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(AppTheme.DARK)
        .mockResolvedValueOnce(ModelType.WHISPER_REALTIME)
        .mockResolvedValueOnce('fr')
        .mockResolvedValueOnce('true')
        .mockResolvedValueOnce('true');

      await useSettingsStore.getState().initialize();
      const state = useSettingsStore.getState();

      expect(state.selectedTheme).toBe(AppTheme.DARK);
      expect(state.selectedModelType).toBe(ModelType.WHISPER_REALTIME);
      expect(state.selectedLanguage).toEqual({ code: 'fr', name: 'French' });
      expect(state.isIncognitoMode).toBe(true);
      expect(state.hasSeenIncognitoExplainer).toBe(true);
    });

    it('falls back to defaults when storage returns null', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await useSettingsStore.getState().initialize();
      const state = useSettingsStore.getState();

      expect(state.selectedTheme).toBe(AppTheme.AUTO);
      expect(state.selectedModelType).toBe(ModelType.WHISPER_FILE);
      expect(state.selectedLanguage).toEqual({ code: 'en', name: 'English' });
      expect(state.isIncognitoMode).toBe(false);
      expect(state.hasSeenIncognitoExplainer).toBe(false);
    });

    it('falls back to default for invalid model type', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('invalid_model')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await useSettingsStore.getState().initialize();
      expect(useSettingsStore.getState().selectedModelType).toBe(
        ModelType.WHISPER_FILE,
      );
    });

    it('falls back to default for invalid language code', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('zzz_invalid')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await useSettingsStore.getState().initialize();
      expect(useSettingsStore.getState().selectedLanguage).toEqual({
        code: 'en',
        name: 'English',
      });
    });

    it('incognito mode is false for non-"true" string', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('false')
        .mockResolvedValueOnce(null);

      await useSettingsStore.getState().initialize();
      expect(useSettingsStore.getState().isIncognitoMode).toBe(false);
    });

    it('falls back to safe defaults on storage error', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
        new Error('storage crash'),
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

  describe('setTheme()', () => {
    it('optimistically updates and persists', async () => {
      await useSettingsStore.getState().setTheme(AppTheme.DARK);

      expect(useSettingsStore.getState().selectedTheme).toBe(AppTheme.DARK);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'selectedTheme',
        AppTheme.DARK,
      );
    });

    it('rolls back on persist failure', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error('write fail'),
      );

      await expect(
        useSettingsStore.getState().setTheme(AppTheme.DARK),
      ).rejects.toThrow('write fail');

      expect(useSettingsStore.getState().selectedTheme).toBe(AppTheme.AUTO);
    });
  });

  describe('setModelType()', () => {
    it('optimistically updates and persists', async () => {
      await useSettingsStore
        .getState()
        .setModelType(ModelType.WHISPER_REALTIME);

      expect(useSettingsStore.getState().selectedModelType).toBe(
        ModelType.WHISPER_REALTIME,
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'selected_model_type',
        ModelType.WHISPER_REALTIME,
      );
    });

    it('rolls back on persist failure', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error('write fail'),
      );

      await expect(
        useSettingsStore.getState().setModelType(ModelType.WHISPER_REALTIME),
      ).rejects.toThrow('write fail');

      expect(useSettingsStore.getState().selectedModelType).toBe(
        ModelType.WHISPER_FILE,
      );
    });
  });

  describe('setLanguage()', () => {
    const french = { code: 'fr', name: 'French' };

    it('optimistically updates and persists the language code', async () => {
      await useSettingsStore.getState().setLanguage(french);

      expect(useSettingsStore.getState().selectedLanguage).toEqual(french);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'spoken_language',
        'fr',
      );
    });

    it('rolls back on persist failure', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error('write fail'),
      );

      await expect(
        useSettingsStore.getState().setLanguage(french),
      ).rejects.toThrow('write fail');

      expect(useSettingsStore.getState().selectedLanguage).toEqual({
        code: 'en',
        name: 'English',
      });
    });
  });

  describe('setIncognitoMode()', () => {
    it('optimistically updates and persists as string', async () => {
      await useSettingsStore.getState().setIncognitoMode(true);

      expect(useSettingsStore.getState().isIncognitoMode).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'incognito_mode',
        'true',
      );
    });

    it('rolls back on persist failure', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error('write fail'),
      );

      await expect(
        useSettingsStore.getState().setIncognitoMode(true),
      ).rejects.toThrow('write fail');

      expect(useSettingsStore.getState().isIncognitoMode).toBe(false);
    });
  });

  describe('markIncognitoExplainerSeen()', () => {
    it('sets true and persists', async () => {
      await useSettingsStore.getState().markIncognitoExplainerSeen();

      expect(useSettingsStore.getState().hasSeenIncognitoExplainer).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'incognito_explainer_seen',
        'true',
      );
    });

    it('does NOT throw on persist failure (fire-and-forget)', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error('write fail'),
      );

      await expect(
        useSettingsStore.getState().markIncognitoExplainerSeen(),
      ).resolves.toBeUndefined();

      // State is still set even though persist failed
      expect(useSettingsStore.getState().hasSeenIncognitoExplainer).toBe(true);
    });
  });
});
