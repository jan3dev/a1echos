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
  RecordingButton = "recording-button",
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
  IncognitoModal = "incognito-modal",
  IncognitoModalVisible = "incognito-modal-visible",

  // --- Session ---
  SessionAppBar = "session-app-bar",
  SessionName = "session-name",
  SessionMoreMenu = "session-more-menu",
  SessionRename = "session-rename",
  SessionDelete = "session-delete",
  SessionShare = "session-share",
  SessionList = "session-list",
  SessionInputModal = "session-input-modal",
  SelectionMode = "selection-mode",
  EditMode = "edit-mode",
  RenameModal = "rename-modal",
  SubmitRename = "submit-rename",
  CancelRename = "cancel-rename",

  // --- Transcription ---
  TranscriptionContent = "transcription-content",
  TranscriptionList = "transcription-list",

  // --- Settings ---
  SettingsModel = "settings-model",
  SettingsTheme = "settings-theme",
  SettingsLanguage = "settings-language",
  SettingsAdvanced = "settings-advanced",
  SettingsContactSupport = "settings-contact-support",
  SettingsFooter = "settings-footer",
  SettingsSmartSplitToggle = "settings-smart-split-toggle",

  // --- Theme Settings ---
  ThemeAuto = "theme-auto",
  ThemeLight = "theme-light",
  ThemeDark = "theme-dark",

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
  SearchIcon = "search-icon",
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
  flag: (name: string) => `flag-${name}`,
  listItem: (title: string) => `list-item-${title}`,
  radio: (value: string) => `radio-${value}`,
  radioSelected: (value: string) => `radio-selected-${value}`,
  trailing: (title: string) => `trailing-${title}`,
  flagIcon: (name: string) => `flag-icon-${name}`,
  sessionItem: (id: string) => `session-item-${id}`,
  menuItem: (title: string) => `menu-item-${title}`,
};
