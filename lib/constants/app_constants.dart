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
}

// Common UI strings
class AppStrings {
  static const String tapToStart =
      'Tap the record button below to start transcribing with the selected model.';
  // Standard UI labels
  static const String loading = 'Loading...';
  static const String processingTranscription = 'Processing transcription...';
  static const String transcribingStatus = 'Transcribing...';
  static const String liveTranscriptionTitle = 'Live Transcription';
  static const String speakNow = 'Speak now...';
  static const String encryptedAtRest = 'Encrypted at rest';

  // HomeScreen actions
  static const String copyAllTooltip = 'Copy All';
  static const String clearAllTooltip = 'Clear All';
  static const String settingsTooltip = 'Settings';

  // Snackbar messages
  static const String noTranscriptionsToCopy = 'No transcriptions to copy';
  static const String allTranscriptionsCopied =
      'All transcriptions copied to clipboard';
  static const String noTranscriptionsToClear = 'No transcriptions to clear';
  static const String allTranscriptionsClearedSession =
      'All transcriptions cleared for this session';

  // Clear All dialog
  static const String clearAllDialogTitle =
      'Clear all transcriptions for this session?';
  static const String clearAllDialogContent = 'This action cannot be undone.';
  static const String cancel = 'Cancel';
  static const String clear = 'Clear';
  static const String paragraphDeleted = 'Paragraph deleted';
  static const String paragraphDeleteFailed = 'Failed to delete paragraph';
  static const String copiedToClipboard = 'Copied to clipboard';
  static const String retryInitialization = 'Retry Initialization';
  
  // Model error dialog
  static const String modelNotReady = 'Model Not Ready';
  static const String modelInitFailure = 'The selected speech recognition model failed to initialize. Please check settings, ensure model files are present, and restart the app.';
  static const String ok = 'OK';
}
