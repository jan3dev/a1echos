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

  // Generic actions and buttons
  static const String save = 'Save';
  static const String cancel = 'Cancel';
  static const String ok = 'OK';
  static const String delete = 'Delete';
  static const String clear = 'Delete All Transcriptions';
  static const String selectAll = 'Select All';
  static const String deleteSelected = 'Delete Selected';
  static const String retry = 'Retry';

  // HomeScreen strings
  static const String homeNewSession = 'New Session';
  static const String homeDeleteSelectedSessionsTitle =
      'Delete Selected Sessions?';
  static const String homeDeleteSelectedSessionsMessage =
      'Are you sure you want to delete {count} {sessions}? This action cannot be undone.';
  static const String homeDeleteSessionsButton = 'Delete Sessions';
  static const String homeSessionsDeleted = 'Sessions deleted';
  static const String homeNewSessionTitle = 'New Session';
  static const String homeErrorCreatingSession =
      'Error creating session: {error}';
  static const String homeSaveRecordingTitle = 'Save Recording?';
  static const String homeSessionSaved = 'Session saved';
  static const String homeRecordingDiscarded = 'Recording discarded';
  static const String homeEmptyStateTitle = 'No Sessions Yet';
  static const String homeEmptyStateMessage =
      'Create a new session to get started';

  // HomeScreen actions
  static const String copyAllTooltip = 'Copy All';
  static const String clearAllTooltip = 'Clear All';
  static const String settingsTooltip = 'Settings';
  static const String newSessionTooltip = 'New Session';

  // SessionScreen strings
  static const String sessionRenameTitle = 'Rename Session';
  static const String sessionDeleteTranscriptionsTitle =
      'Delete Transcriptions?';
  static const String sessionDeleteTranscriptionsMessage =
      'Are you sure you want to delete {count} {transcriptions}? This action cannot be undone.';
  static const String sessionDeleteTranscriptionsButton = 'Delete';
  static const String sessionTranscriptionsDeleted = 'Transcriptions deleted';
  static const String sessionErrorDeletingTranscriptions =
      'Error deleting transcriptions: {error}';
  static const String sessionEmptyStateTitle = 'No Transcriptions in Session';
  static const String sessionEmptyStateMessage =
      'Start recording to add transcriptions to this session.';
  
  // Snackbar messages
  static const String noTranscriptionsToCopy = 'No transcriptions to copy';
  static const String allTranscriptionsCopied =
      'All transcriptions copied to clipboard';
  static const String noTranscriptionsToClear = 'No transcriptions to clear';
  static const String allTranscriptionsClearedSession =
      'All transcriptions cleared for this session';

  // Clear All dialog
  static const String clearAllDialogTitle = 'Delete All Transcriptions?';
  static const String clearAllDialogContent =
      'Are you sure you want to delete all transcriptions for this session? This action cannot be undone.';
  static const String paragraphDeleted = 'Paragraph deleted';
  static const String paragraphDeleteFailed = 'Failed to delete paragraph';
  static const String copiedToClipboard = 'Copied to clipboard';
  static const String retryInitialization = 'Retry Initialization';
  
  // Model error dialog
  static const String modelNotReady = 'Model Not Ready';
  static const String modelInitFailure =
      'The selected speech recognition model failed to initialize. Please check settings, ensure model files are present, and restart the app.';

  // Settings Screen
  static const String settingsTitle = 'Settings';
  static const String transcriptionModelTitle = 'Transcription Model';
  static const String transcriptionModelDescription =
      'Select which model to use. All processing happens on your device.';
  static const String voskModelTitle = 'Vosk (Small EN)';
  static const String voskModelSubtitle =
      'Faster, real-time streaming transcription. Good for general use.';
  static const String whisperModelTitle = 'Whisper (Base EN)';
  static const String whisperModelSubtitle =
      'Higher accuracy, processes audio after recording stops (no streaming).';
  
  // Recording strings
  static const String recordingPrefix = 'Recording';
  static const String defaultSessionName = 'New Session';
  static const String defaultSessionTitle = 'Default Session';
  
  // Empty states
  static const String emptyTranscriptionsTitle = 'No Transcriptions Yet';
  static const String emptyTranscriptionsMessage =
      'Hit the record button to start capturing and transcribing your voice notes.';
  static const String emptySessionsTitle = 'No Sessions Yet';
  static const String emptySessionsMessage =
      'Create a new session or start recording to get started.';
  static const String noSessionsFound = 'No sessions found.';
  
  // TranscriptionItem
  static const String copyToClipboard = 'Copied to clipboard';
  
  // SessionListItem
  static const String modifiedPrefix = 'Modified';

  // ErrorView
  static const String errorPrefix = 'Error:';
  
  // SessionInputModal
  static const String sessionNameLabel = 'Session Name';
  static const String sessionNameHint = 'Enter session name';
  
  // ModelStatusTile
  static const String modelReadySuffix = 'model is ready.';
  static const String modelFailedInitSuffix = 'model failed to initialize.';
  static const String initializingModelPrefix = 'Initializing';
  static const String modelSuffix = 'model...';
  static const String retryInitializationButton = 'Retry Initialization';
}
