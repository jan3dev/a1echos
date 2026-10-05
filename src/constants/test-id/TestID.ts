/**
 * Centralized test ID constants for production components and test mocks.
 * Use these enums in both production code and test assertions
 * to avoid string mismatches.
 */

export enum TestID {
  // --- Layout ---
  AppErrorBoundary = "app-error-boundary",
  Stack = "stack",
  MaskedView = "masked-view",

  // --- TopAppBar ---
  TopAppBar = "top-app-bar",
  TopAppBarBack = "top-app-bar-back",
  TitlePressable = "title-pressable",
  TitleText = "title-text",

  // --- Recording ---
  RecordingButtonStart = "recording-button-start",
  RecordingButtonStop = "recording-button-stop",
  RecordingButtonTranscribing = "recording-button-transcribing",
  RecordingButtonStarting = "recording-button-starting",
  RecordingButton = "recording-button",
  TranscriptionSettingsSheet = "transcription-settings-sheet",
  TranscriptionSettingsDragHeader = "transcription-settings-drag-header",
  TranscriptionSettingsLanguage = "transcription-settings-language",
  TranscriptionSettingsBack = "transcription-settings-back",
  TranscriptionSettingsHandle = "transcription-settings-handle",
  RecordingControlsView = "recording-controls-view",
  BtnStart = "btn-start",
  BtnStop = "btn-stop",
  ThreeWaveLines = "three-wave-lines",

  // --- Home ---
  HomeAppBar = "home-app-bar",
  HomeAppBarSelection = "home-app-bar-selection",
  HomeContent = "home-content",
  HomeContentSelection = "home-content-selection",
  HomeSettingsButton = "home-settings-button",
  EmptyStateView = "empty-state-view",
  IncognitoEmptyState = "incognito-empty-state",

  // --- Session ---
  SessionAppBar = "session-app-bar",
  SessionName = "session-name",
  SessionMoreMenu = "session-more-menu",
  SessionActionsSheet = "session-actions-sheet",
  FolderActionsSheet = "folder-actions-sheet",
  SessionRename = "session-rename",
  SessionDelete = "session-delete",
  SessionAddToFolder = "session-add-to-folder",
  SessionCopyText = "session-copy-text",
  SessionDownloadMarkdown = "session-download-markdown",
  SessionShareVia = "session-share-via",
  SessionShareSheet = "session-share-sheet",
  SessionUpload = "session-upload",
  SessionShare = "session-share",
  AddToFolderClose = "add-to-folder-close",
  AddToFolderSave = "add-to-folder-save",
  TranscriptionEditInput = "transcription-edit-input",
  TranscriptionEditSave = "transcription-edit-save",
  TranscriptionEditClose = "transcription-edit-close",
  TranscriptionEditAudio = "transcription-edit-audio",
  TranscriptionEditLanguage = "transcription-edit-language",
  TranscriptionEditReprocess = "transcription-edit-reprocess",
  SessionList = "session-list",
  FolderCloseButton = "folder-close-button",
  SessionInputModal = "session-input-modal",
  SessionInputModalCard = "session-input-modal-card",
  SelectionMode = "selection-mode",
  RenameModal = "rename-modal",
  SubmitRename = "submit-rename",
  CancelRename = "cancel-rename",

  // --- Transcription ---
  TranscriptionContent = "transcription-content",
  TranscriptionList = "transcription-list",

  // --- Settings ---
  SettingsModel = "settings-model",
  SettingsTheme = "settings-theme",
  SettingsTextAppearance = "settings-text-appearance",
  SettingsLanguage = "settings-language",
  SettingsAdvanced = "settings-advanced",
  SettingsContactSupport = "settings-contact-support",
  SettingsBiometricAuthToggle = "settings-biometric-auth-toggle",
  BiometricLockScreen = "biometric-lock-screen",
  SettingsFooter = "settings-footer",
  SettingsSmartSplitToggle = "settings-smart-split-toggle",
  SettingsKeyboardAutocorrectToggle = "settings-keyboard-autocorrect-toggle",
  SettingsKeyboardHapticToggle = "settings-keyboard-haptic-toggle",
  SettingsKeyboardSoundToggle = "settings-keyboard-sound-toggle",
  SettingsMicTimeoutRow = "settings-mic-timeout-row",
  SettingsAddKeyboardRow = "settings-add-keyboard-row",
  KeyboardPromptModal = "keyboard-prompt-modal",
  KeyboardPromptImageIos = "keyboard-prompt-image-ios",
  KeyboardPromptImageAndroid = "keyboard-prompt-image-android",
  VoiceSessionHintModal = "voice-session-hint-modal",
  LargerModelSuggestionModal = "larger-model-suggestion-modal",

  // --- Theme Settings ---
  ThemeAuto = "theme-auto",
  ThemeLight = "theme-light",
  ThemeDark = "theme-dark",

  // --- Text Appearance Settings ---
  TextAppearancePreview = "text-appearance-preview",
  TextAppearanceSizeSlider = "text-appearance-size-slider",
  TextAppearanceBoldToggle = "text-appearance-bold-toggle",

  // --- Microphone Timeout Settings ---
  MicTimeoutOption = "mic-timeout-option",

  // --- Model Settings ---
  ModelWhisperFile = "model-whisper-file",
  ModelWhisperRealtime = "model-whisper-realtime",

  // --- Shared UI Components ---
  Card = "card",
  Checkbox = "checkbox",
  Divider = "divider",
  Dimmer = "dimmer",
  DimmerBackdrop = "dimmer-backdrop",
  ErrorView = "error-view",
  InAppBanner = "in-app-banner",
  ListItem = "list-item",
  ListItemTitle = "list-item-title",
  ListItemSubtitle = "list-item-subtitle",
  ListItemTrailing = "list-item-trailing",
  Modal = "modal",
  ModalTitle = "modal-title",
  ModalMessage = "modal-message",
  PrimaryButton = "primary-button",
  ClearButton = "clear-button",
  ProgressIndicator = "progress-indicator",
  RetryButton = "retry-button",
  ShareButton = "share-button",
  Skeleton = "skeleton",
  TextField = "text-field",
  Toast = "toast",
  DeleteToast = "delete-toast",
  Tooltip = "tooltip",
  TooltipActionBtn = "tooltip-action-btn",
  GlobalTooltipContainer = "global-tooltip-container",

  // --- Test Helpers ---
  ConfirmBtn = "confirm-btn",
  CancelBtn = "cancel-btn",
  CustomLeading = "custom-leading",
  CustomTitleWidget = "custom-title-widget",
  CustomWidget = "custom-widget",
  CustomTestId = "custom-test-id",
  CustomLeadingIcon = "custom-leading-icon",
  CustomTrailingIcon = "custom-trailing-icon",
  CustomIconPressable = "custom-icon-pressable",
  LeadingIcon = "leading-icon",
  TrailingIcon = "trailing-icon",
  TestIcon = "test-icon",
  UtilIcon = "util-icon",
  SkiaCanvas = "skia-canvas",
  SkiaPath = "skia-path",
  MockSvg = "mock-svg",
  MockFlagSvg = "mock-flag-svg",
}

/** Helper functions for dynamic testIDs */
export const dynamicTestID = {
  session: (id: string) => `session-${id}`,
  language: (code: string) => `language-${code}`,
  modal: (title: string) => `modal-${title.toLowerCase().replace(/\s+/g, "-")}`,
  icon: (name: string) => `icon-${name}`,
  listItem: (title: string) => `list-item-${title}`,
  radio: (value: string) => `radio-${value}`,
  radioSelected: (value: string) => `radio-selected-${value}`,
  trailing: (title: string) => `trailing-${title}`,
  flagIcon: (name: string) => `flag-icon-${name}`,
  sessionItem: (id: string) => `session-item-${id}`,
  menuItem: (title: string) => `menu-item-${title}`,
  fontOption: (font: string) => `font-option-${font}`,
};
