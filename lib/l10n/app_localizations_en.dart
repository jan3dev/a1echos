// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get loading => 'Loading...';

  @override
  String get transcribingStatus => 'Transcribing...';

  @override
  String get liveTranscriptionTitle => 'Live Transcription';

  @override
  String get speakNow => 'Speak now...';

  @override
  String get encryptedAtRest => 'Encrypted at rest';

  @override
  String get save => 'Save';

  @override
  String get cancel => 'Cancel';

  @override
  String get ok => 'OK';

  @override
  String get delete => 'Delete';

  @override
  String get clear => 'Delete All Transcriptions';

  @override
  String get retry => 'Retry';

  @override
  String get share => 'Share';

  @override
  String get edit => 'Edit';

  @override
  String get homeDeleteSelectedSessionsTitle => 'Delete?';

  @override
  String homeDeleteSelectedSessionsMessage(Object count, Object sessions) {
    return 'Are you sure you want to delete $count $sessions? This action cannot be undone.';
  }

  @override
  String homeSessionsDeleted(Object sessions) {
    return '$sessions deleted';
  }

  @override
  String homeErrorCreatingSession(Object error) {
    return 'Error creating session: $error';
  }

  @override
  String get clearAllTooltip => 'Clear All';

  @override
  String get newSessionTooltip => 'New Session';

  @override
  String get sessionRenameTitle => 'Rename';

  @override
  String get sessionDeleteTranscriptionsTitle => 'Delete?';

  @override
  String sessionDeleteTranscriptionsMessage(
    Object count,
    Object transcriptions,
  ) {
    return 'Are you sure you want to delete $count $transcriptions? This action cannot be undone.';
  }

  @override
  String sessionTranscriptionsDeleted(Object transcriptions) {
    return '$transcriptions deleted';
  }

  @override
  String sessionErrorDeletingTranscriptions(
    Object transcriptions,
    Object error,
  ) {
    return 'Error deleting $transcriptions: $error';
  }

  @override
  String get noTranscriptionsToCopy => 'No transcriptions to copy';

  @override
  String get allTranscriptionsCopied =>
      'All transcriptions copied to clipboard';

  @override
  String get noTranscriptionsToClear => 'No transcriptions to clear';

  @override
  String get allTranscriptionsClearedSession =>
      'All transcriptions cleared for this session';

  @override
  String get copiedToClipboard => 'Copied to clipboard';

  @override
  String get retryInitialization => 'Retry Initialization';

  @override
  String get modelNotReady => 'Model Not Ready';

  @override
  String get modelInitFailure =>
      'The selected speech recognition model failed to initialize. Please check settings, ensure model files are present, and restart the app.';

  @override
  String get settingsTitle => 'Settings';

  @override
  String get modelTitle => 'Model';

  @override
  String get themeTitle => 'Theme';

  @override
  String get auto => 'Auto';

  @override
  String get light => 'Light';

  @override
  String get dark => 'Dark';

  @override
  String get modelDescription =>
      'Select which model to use. All processing happens on your device.';

  @override
  String get voskModelTitle => 'Vosk';

  @override
  String get voskModelSubtitle => 'Fast, real-time';

  @override
  String get whisperModelTitle => 'Whisper';

  @override
  String get whisperModelRealtimeTitle => 'Whisper (Real-time)';

  @override
  String get whisperModelFileTitle => 'Whisper';

  @override
  String get whisperModelSubtitle => 'High accuracy';

  @override
  String get followUs => 'Follow us on X';

  @override
  String get recordingPrefix => 'Session';

  @override
  String get emptySessionsMessage =>
      'Hit the record button to start transcribing';

  @override
  String get copyToClipboard => 'Copied to clipboard';

  @override
  String get modifiedPrefix => 'Modified';

  @override
  String get errorPrefix => 'Error:';

  @override
  String get sessionNameLabel => 'Session Name';

  @override
  String get sessionNameMaxLengthHelper => 'Max 30 characters.';

  @override
  String get modelReadySuffix => 'model is ready.';

  @override
  String get modelFailedInitSuffix => 'model failed to initialize.';

  @override
  String get initializingModelPrefix => 'Initializing';

  @override
  String get modelSuffix => 'model...';

  @override
  String get retryInitializationButton => 'Retry Initialization';

  @override
  String get incognitoModeTitle => 'Incognito';

  @override
  String get incognitoExplainerTitle => 'Incognito Mode';

  @override
  String get incognitoExplainerBody =>
      'Transcibe without saving. This session won\'t be stored or synced anywhere.';

  @override
  String get incognitoExplainerCta => 'Got it!';
}
