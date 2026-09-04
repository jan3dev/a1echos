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
import { sherpaTranscriptionService } from "@/services";
import { FeatureFlag, logError, logWarn, writeKeyboardSettings } from "@/utils";

import { preWarmModel } from "../transcription-store/preWarmModel";

const STORAGE_KEYS = {
  THEME: "selectedTheme",
  MODEL_TYPE: "selected_model_type",
  MODEL_ID: "selected_model_id",
  TRANSCRIPTION_MODE: "selected_transcription_mode",
  MODEL_MODES: "model_modes",
  LANGUAGE: "spoken_language",
  INCOGNITO_MODE: "incognito_mode",
  SMART_SPLIT_ENABLED: "smart_split_enabled",
  KEYBOARD_PROMPT_SEEN: "keyboard_prompt_seen",
  KEYBOARD_AUTOCORRECT: "keyboard_autocorrect",
  KEYBOARD_HAPTIC: "keyboard_haptic",
  KEYBOARD_SOUND: "keyboard_sound",
  KEYBOARD_MIC_TIMEOUT: "keyboard_mic_timeout",
  HAS_SEEN_WELCOME: "has_seen_welcome",
  LARGER_MODEL_SUGGESTION_SEEN: "larger_model_suggestion_seen",
};

type ModelModes = Partial<Record<ModelId, TranscriptionMode>>;

/** Selectable durations (seconds) a keyboard voice-typing session stays armed
 *  in the background. `0` = Off. Surfaced as the "Microphone timeout" picker. */
export const KEYBOARD_MIC_TIMEOUT_OPTIONS = [0, 60, 300, 1200, 3600] as const;

/** Default session length: 5 minutes — long enough for a dictation sitting,
 *  short enough to limit background battery use. */
const DEFAULT_MIC_TIMEOUT_SECONDS = 300;

/** Clamps a persisted/raw value to a known option, falling back to the default. */
const parseMicTimeout = (raw: string | null): number => {
  if (raw === null) return DEFAULT_MIC_TIMEOUT_SECONDS;
  const value = Number(raw);
  return (KEYBOARD_MIC_TIMEOUT_OPTIONS as readonly number[]).includes(value)
    ? value
    : DEFAULT_MIC_TIMEOUT_SECONDS;
};

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
  smartSplitEnabled: boolean;
  hasSeenKeyboardPrompt: boolean;
  /** Keyboard: auto-apply the top spelling guess on space (default off =
   *  tap-to-apply suggestions only). */
  keyboardAutocorrect: boolean;
  /** Keyboard: play a light haptic on each key press (default on). */
  keyboardHaptic: boolean;
  /** Keyboard: play a key-click sound on each key press (default on). On iOS
   *  the click also requires the keyboard's Full Access permission. */
  keyboardSound: boolean;
  /** Keyboard: how long (seconds) a voice-typing session stays armed in the
   *  background after being started from an external app. `0` = Off. */
  keyboardMicTimeoutSeconds: number;
  /** Whether the one-time first-launch welcome screen has been shown. */
  hasSeenWelcome: boolean;
  /** Whether the one-time "try a larger model" sheet has been shown. Offered
   *  the first time a non-English language is picked while still on the small
   *  bundled model, which transcribes other languages noticeably worse. */
  hasSeenLargerModelSuggestion: boolean;

  initialize: () => Promise<void>;
  setTheme: (theme: AppTheme) => Promise<void>;
  /** @deprecated Use setModelId + setTranscriptionMode */
  setModelType: (modelType: ModelType) => Promise<void>;
  setModelId: (modelId: ModelId) => Promise<void>;
  setTranscriptionMode: (mode: TranscriptionMode) => Promise<void>;
  setModelMode: (modelId: ModelId, mode: TranscriptionMode) => Promise<void>;
  setLanguage: (language: SpokenLanguage) => Promise<void>;
  setIncognitoMode: (enabled: boolean) => Promise<void>;
  setSmartSplitEnabled: (enabled: boolean) => Promise<void>;
  markKeyboardPromptSeen: () => Promise<void>;
  setKeyboardAutocorrect: (enabled: boolean) => Promise<void>;
  setKeyboardHaptic: (enabled: boolean) => Promise<void>;
  setKeyboardSound: (enabled: boolean) => Promise<void>;
  setKeyboardMicTimeout: (seconds: number) => Promise<void>;
  markWelcomeSeen: () => Promise<void>;
  markLargerModelSuggestionSeen: () => Promise<void>;
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

/**
 * Mirror every keyboard preference to the config file the native keyboards
 * read. Reads the current store state, so callers just `set()` then call this —
 * no need to thread the other flags' values through by hand.
 */
const syncKeyboardConfig = (get: () => SettingsStore): void => {
  const {
    keyboardAutocorrect,
    keyboardHaptic,
    keyboardSound,
    keyboardMicTimeoutSeconds,
  } = get();
  writeKeyboardSettings({
    autocorrect: keyboardAutocorrect,
    hapticFeedback: keyboardHaptic,
    keySound: keyboardSound,
    micTimeoutSeconds: keyboardMicTimeoutSeconds,
  });
};

/** The `set`/`get` pair zustand hands the store creator. */
interface SettingsStoreApi {
  set: (partial: Partial<SettingsStore>) => void;
  get: () => SettingsStore;
}

/** Keyboard preference fields — the ones mirrored to the native config file. */
type KeyboardSettingField =
  | "keyboardAutocorrect"
  | "keyboardHaptic"
  | "keyboardSound"
  | "keyboardMicTimeoutSeconds";

/**
 * Persists one keyboard preference: optimistically applies it and mirrors it
 * to the native config file (so the keyboards pick it up on next field focus),
 * then rolls both back and rethrows if the write fails. Every keyboard setter
 * shares this shape — the rollback must re-sync, or the config file keeps a
 * value the store no longer holds.
 */
const persistKeyboardSetting = async <F extends KeyboardSettingField>(
  { set, get }: SettingsStoreApi,
  field: F,
  storageKey: string,
  value: SettingsStore[F],
  label: string,
): Promise<void> => {
  const previousValue = get()[field];
  if (previousValue === value) return;
  set({ [field]: value } as Pick<SettingsStore, F>);
  syncKeyboardConfig(get);
  try {
    await AsyncStorage.setItem(storageKey, String(value));
  } catch (error) {
    logError(error, {
      flag: FeatureFlag.settings,
      message: `Failed to save ${label} preference`,
    });
    set({ [field]: previousValue } as Pick<SettingsStore, F>);
    syncKeyboardConfig(get);
    throw error;
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
  smartSplitEnabled: true,
  hasSeenKeyboardPrompt: false,
  keyboardAutocorrect: true,
  keyboardHaptic: true,
  keyboardSound: true,
  keyboardMicTimeoutSeconds: DEFAULT_MIC_TIMEOUT_SECONDS,
  hasSeenWelcome: false,
  hasSeenLargerModelSuggestion: false,

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
        smartSplitValue,
        keyboardPromptValue,
        keyboardAutocorrectValue,
        keyboardHapticValue,
        keyboardSoundValue,
        keyboardMicTimeoutValue,
        hasSeenWelcomeValue,
        largerModelSuggestionValue,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.THEME),
        AsyncStorage.getItem(STORAGE_KEYS.MODEL_TYPE),
        AsyncStorage.getItem(STORAGE_KEYS.MODEL_ID),
        AsyncStorage.getItem(STORAGE_KEYS.TRANSCRIPTION_MODE),
        AsyncStorage.getItem(STORAGE_KEYS.MODEL_MODES),
        AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE),
        AsyncStorage.getItem(STORAGE_KEYS.INCOGNITO_MODE),
        AsyncStorage.getItem(STORAGE_KEYS.SMART_SPLIT_ENABLED),
        AsyncStorage.getItem(STORAGE_KEYS.KEYBOARD_PROMPT_SEEN),
        AsyncStorage.getItem(STORAGE_KEYS.KEYBOARD_AUTOCORRECT),
        AsyncStorage.getItem(STORAGE_KEYS.KEYBOARD_HAPTIC),
        AsyncStorage.getItem(STORAGE_KEYS.KEYBOARD_SOUND),
        AsyncStorage.getItem(STORAGE_KEYS.KEYBOARD_MIC_TIMEOUT),
        AsyncStorage.getItem(STORAGE_KEYS.HAS_SEEN_WELCOME),
        AsyncStorage.getItem(STORAGE_KEYS.LARGER_MODEL_SUGGESTION_SEEN),
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
      // Default true — only the explicit string "false" disables.
      const smartSplitEnabled =
        smartSplitValue === null || smartSplitValue === "true";
      const hasSeenKeyboardPrompt = keyboardPromptValue === "true";
      // Default true (matching native keyboards) — only the explicit string
      // "false" disables autocorrect.
      const keyboardAutocorrect = keyboardAutocorrectValue !== "false";
      // Default true — only the explicit string "false" disables haptics.
      const keyboardHaptic = keyboardHapticValue !== "false";
      // Default true — only the explicit string "false" disables key sounds.
      const keyboardSound = keyboardSoundValue !== "false";
      const keyboardMicTimeoutSeconds = parseMicTimeout(
        keyboardMicTimeoutValue,
      );
      const hasSeenWelcome = hasSeenWelcomeValue === "true";
      const hasSeenLargerModelSuggestion = largerModelSuggestionValue === "true";

      set({
        selectedTheme,
        selectedModelType,
        selectedModelId,
        selectedTranscriptionMode,
        modelModes,
        selectedLanguage,
        isIncognitoMode,
        smartSplitEnabled,
        hasSeenKeyboardPrompt,
        keyboardAutocorrect,
        keyboardHaptic,
        keyboardSound,
        keyboardMicTimeoutSeconds,
        hasSeenWelcome,
        hasSeenLargerModelSuggestion,
      });

      // Mirror the preferences to the keyboard config file so the native
      // keyboards have them on first launch (and after a reinstall) without
      // waiting for the user to toggle them.
      syncKeyboardConfig(get);
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
        smartSplitEnabled: true,
        hasSeenKeyboardPrompt: false,
        keyboardAutocorrect: true,
        keyboardHaptic: true,
        keyboardSound: true,
        keyboardMicTimeoutSeconds: DEFAULT_MIC_TIMEOUT_SECONDS,
        hasSeenWelcome: false,
        hasSeenLargerModelSuggestion: false,
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

      // Refresh the keyboard's model config so the IME / iOS extension see
      // the new model without waiting for the next recording. preWarmModel
      // would also write this via `initialize()`, but it skips during
      // recording or when the model isn't yet downloaded — refresh covers
      // those cases too.
      sherpaTranscriptionService.refreshKeyboardConfig(
        modelId,
        get().selectedLanguage.code,
      );

      // Pre-warm the engine so the next record tap doesn't pay the multi-second
      // sherpa-onnx init cost. Use the language *after* the auto-reset above.
      preWarmModel(modelId, get().selectedLanguage.code);
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
      // Update the keyboard's model config so the IME / iOS extension
      // pick up the new spoken language on the next mic press without
      // waiting for the next in-app recording (which is what otherwise
      // triggers `sherpaTranscriptionService.initialize`).
      sherpaTranscriptionService.refreshKeyboardConfig(
        get().selectedModelId,
        language.code,
      );
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
    if (previousValue === enabled) return;
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

  setSmartSplitEnabled: async (enabled: boolean) => {
    const previousValue = get().smartSplitEnabled;
    set({ smartSplitEnabled: enabled });
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.SMART_SPLIT_ENABLED,
        enabled.toString(),
      );
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.settings,
        message: "Failed to save smart split preference",
      });
      set({ smartSplitEnabled: previousValue });
    }
  },

  markKeyboardPromptSeen: async () => {
    set({ hasSeenKeyboardPrompt: true });
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.KEYBOARD_PROMPT_SEEN, "true");
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.settings,
        message: "Failed to save keyboard prompt flag",
      });
    }
  },

  setKeyboardAutocorrect: async (enabled: boolean) =>
    persistKeyboardSetting(
      { set, get },
      "keyboardAutocorrect",
      STORAGE_KEYS.KEYBOARD_AUTOCORRECT,
      enabled,
      "keyboard autocorrect",
    ),

  setKeyboardHaptic: async (enabled: boolean) =>
    persistKeyboardSetting(
      { set, get },
      "keyboardHaptic",
      STORAGE_KEYS.KEYBOARD_HAPTIC,
      enabled,
      "keyboard haptic",
    ),

  setKeyboardSound: async (enabled: boolean) =>
    persistKeyboardSetting(
      { set, get },
      "keyboardSound",
      STORAGE_KEYS.KEYBOARD_SOUND,
      enabled,
      "keyboard sound",
    ),

  setKeyboardMicTimeout: async (seconds: number) =>
    persistKeyboardSetting(
      { set, get },
      "keyboardMicTimeoutSeconds",
      STORAGE_KEYS.KEYBOARD_MIC_TIMEOUT,
      seconds,
      "keyboard mic timeout",
    ),

  markWelcomeSeen: async () => {
    set({ hasSeenWelcome: true });
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.HAS_SEEN_WELCOME, "true");
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.settings,
        message: "Failed to save welcome seen flag",
      });
    }
  },

  markLargerModelSuggestionSeen: async () => {
    set({ hasSeenLargerModelSuggestion: true });
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.LARGER_MODEL_SUGGESTION_SEEN,
        "true",
      );
    } catch (error) {
      logError(error, {
        flag: FeatureFlag.settings,
        message: "Failed to save larger model suggestion flag",
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
export const useSetIncognitoMode = () =>
  useSettingsStore((s) => s.setIncognitoMode);
export const useSetLanguage = () => useSettingsStore((s) => s.setLanguage);
export const useSetModelType = () => useSettingsStore((s) => s.setModelType);
export const useSetModelId = () => useSettingsStore((s) => s.setModelId);
export const useSetTranscriptionMode = () =>
  useSettingsStore((s) => s.setTranscriptionMode);
export const useSetModelMode = () => useSettingsStore((s) => s.setModelMode);
export const useSetTheme = () => useSettingsStore((s) => s.setTheme);
export const useSmartSplitEnabled = () =>
  useSettingsStore((s) => s.smartSplitEnabled);
export const useSetSmartSplitEnabled = () =>
  useSettingsStore((s) => s.setSmartSplitEnabled);
export const useHasSeenKeyboardPrompt = () =>
  useSettingsStore((s) => s.hasSeenKeyboardPrompt);
export const useMarkKeyboardPromptSeen = () =>
  useSettingsStore((s) => s.markKeyboardPromptSeen);
export const useKeyboardAutocorrect = () =>
  useSettingsStore((s) => s.keyboardAutocorrect);
export const useSetKeyboardAutocorrect = () =>
  useSettingsStore((s) => s.setKeyboardAutocorrect);
export const useKeyboardHaptic = () =>
  useSettingsStore((s) => s.keyboardHaptic);
export const useSetKeyboardHaptic = () =>
  useSettingsStore((s) => s.setKeyboardHaptic);
export const useKeyboardSound = () => useSettingsStore((s) => s.keyboardSound);
export const useSetKeyboardSound = () =>
  useSettingsStore((s) => s.setKeyboardSound);
export const useKeyboardMicTimeout = () =>
  useSettingsStore((s) => s.keyboardMicTimeoutSeconds);
export const useSetKeyboardMicTimeout = () =>
  useSettingsStore((s) => s.setKeyboardMicTimeout);
export const useHasSeenWelcome = () =>
  useSettingsStore((s) => s.hasSeenWelcome);
export const useMarkWelcomeSeen = () =>
  useSettingsStore((s) => s.markWelcomeSeen);
export const useHasSeenLargerModelSuggestion = () =>
  useSettingsStore((s) => s.hasSeenLargerModelSuggestion);
export const useMarkLargerModelSuggestionSeen = () =>
  useSettingsStore((s) => s.markLargerModelSuggestionSeen);
export const initializeSettingsStore = async (): Promise<void> => {
  await useSettingsStore.getState().initialize();
};

export default useSettingsStore;
