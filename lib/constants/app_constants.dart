// Common constants for recording durations and text formatting
class AppConstants {
  // Maximum recording duration before auto-stopping
  static const Duration recordingMaxDuration = Duration(minutes: 5);
  // Interval for checking recording duration
  static const Duration recordingCheckInterval = Duration(seconds: 30);

  // Standard snackbar durations
  static const Duration snackBarDurationShort = Duration(seconds: 2);

  // Number of words per paragraph when no sentence-ending punctuation
  static const int wordsPerParagraph = 30;
  // Number of sentences per paragraph when sentence punctuation exists
  static const int sentencesPerParagraph = 3;

  // Maximum allowed length for session names
  static const int sessionNameMaxLength = 30;
}

// Common UI strings
class AppStrings {
  // Standard UI labels
  static const String loading = 'Loading...';
  static const String transcribingStatus = 'Transcribing...';
  static const String liveTranscriptionTitle = 'Live Transcription';
  static const String speakNow = 'Speak now...';
  static const String encryptedAtRest = 'Encrypted at rest';

  // Generic actions and buttons
  static const String save = 'Save';
  static const String cancel = 'Cancel';
  static const String ok = 'OK';
  static const String delete = 'Delete';
  static const String clear = 'Delete All Transcriptions';
  static const String retry = 'Retry';
  static const String share = 'Share';

  // HomeScreen strings
  static const String homeDeleteSelectedSessionsTitle = 'Delete?';
  static const String homeDeleteSelectedSessionsMessage =
      'Are you sure you want to delete {count} {sessions}? This action cannot be undone.';
  static const String homeSessionsDeleted = '{sessions} deleted';
  static const String homeErrorCreatingSession =
      'Error creating session: {error}';

  // HomeScreen actions
  static const String clearAllTooltip = 'Clear All';
  static const String newSessionTooltip = 'New Session';

  // SessionScreen strings
  static const String sessionRenameTitle = 'Rename';
  static const String sessionDeleteTranscriptionsTitle = 'Delete?';
  static const String sessionDeleteTranscriptionsMessage =
      'Are you sure you want to delete {count} {transcriptions}? This action cannot be undone.';
  static const String sessionTranscriptionsDeleted = '{transcriptions} deleted';
  static const String sessionErrorDeletingTranscriptions =
      'Error deleting {transcriptions}: {error}';

  // Snackbar messages
  static const String noTranscriptionsToCopy = 'No transcriptions to copy';
  static const String allTranscriptionsCopied =
      'All transcriptions copied to clipboard';
  static const String noTranscriptionsToClear = 'No transcriptions to clear';
  static const String allTranscriptionsClearedSession =
      'All transcriptions cleared for this session';

  // Clear All dialog
  static const String copiedToClipboard = 'Copied to clipboard';
  static const String retryInitialization = 'Retry Initialization';

  // Model error dialog
  static const String modelNotReady = 'Model Not Ready';
  static const String modelInitFailure =
      'The selected speech recognition model failed to initialize. Please check settings, ensure model files are present, and restart the app.';

  // Settings Screen
  static const String settingsTitle = 'Settings';
  static const String modelTitle = 'Model';
  static const String themeTitle = 'Theme';
  static const String auto = 'Auto';
  static const String light = 'Light';
  static const String dark = 'Dark';
  static const String modelDescription =
      'Select which model to use. All processing happens on your device.';
  static const String voskModelTitle = 'Vosk';
  static const String voskModelSubtitle = 'Fast, real-time';
  static const String whisperModelTitle = 'Whisper';
  static const String whisperModelRealtimeTitle = 'Whisper (Real-time)';
  static const String whisperModelFileTitle = 'Whisper';
  static const String whisperModelSubtitle = 'High accuracy';
  static const String followUs = 'Follow us';

  // Recording strings
  static const String recordingPrefix = 'Session';

  // Empty states
  static const String emptySessionsMessage =
      'Hit the record button to start transcribing';

  // TranscriptionItem
  static const String copyToClipboard = 'Copied to clipboard';

  // SessionListItem
  static const String modifiedPrefix = 'Modified';

  // ErrorView
  static const String errorPrefix = 'Error:';

  // SessionInputModal
  static const String sessionNameLabel = 'Session Name';
  static const String sessionNameHint = 'Enter session name';
  static const String sessionNameMaxLengthHelper = 'Max 30 characters.';

  // ModelStatusTile
  static const String modelReadySuffix = 'model is ready.';
  static const String modelFailedInitSuffix = 'model failed to initialize.';
  static const String initializingModelPrefix = 'Initializing';
  static const String modelSuffix = 'model...';
  static const String retryInitializationButton = 'Retry Initialization';

  // Incognito Mode Settings
  static const String incognitoModeTitle = 'Incognito';
  // Incognito Explainer Modal
  static const String incognitoExplainerTitle = 'Incognito Mode';
  static const String incognitoExplainerBody =
      'Transcibe without saving. This session won\'t be stored or synced anywhere.';
  static const String incognitoExplainerCta = 'Got it!';
}
