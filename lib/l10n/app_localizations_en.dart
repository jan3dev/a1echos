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
  String homeDeleteSelectedSessionsMessage(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count sessions',
      one: '1 session',
    );
    return 'Are you sure you want to delete $_temp0? This action cannot be undone.';
  }

  @override
  String homeSessionsDeleted(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count sessions deleted',
      one: '1 session deleted',
    );
    return '$_temp0';
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
  String sessionDeleteTranscriptionsMessage(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count transcriptions',
      one: '1 transcription',
    );
    return 'Are you sure you want to delete $_temp0? This action cannot be undone.';
  }

  @override
  String sessionTranscriptionsDeleted(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count transcriptions deleted',
      one: '1 transcription deleted',
    );
    return '$_temp0';
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

  @override
  String copyFailed(Object error) {
    return 'Failed to copy: $error';
  }

  @override
  String get noTranscriptionsSelectedToShare =>
      'No transcriptions selected to share';

  @override
  String shareFailed(Object error) {
    return 'Failed to share: $error';
  }

  @override
  String actionFailedTitle(Object action) {
    return '$action Failed';
  }

  @override
  String genericErrorRetry(Object error) {
    return 'An error occurred: $error\\n\\nPlease try again in a moment.';
  }

  @override
  String get couldNotOpenLink => 'Could not open link';

  @override
  String get createdPrefix => 'Created';

  @override
  String get spokenLanguageTitle => 'Spoken Language';

  @override
  String get spokenLanguageDescription =>
      'Choose which language the model should detect. For best results, select the language you mainly speak.';

  @override
  String get spokenLanguageDisabledForVosk =>
      'Language selection is only available for Whisper models. Vosk only supports English.';

  @override
  String get languageEnglish => 'English';

  @override
  String get languageChinese => 'Chinese';

  @override
  String get languageGerman => 'German';

  @override
  String get languageSpanish => 'Spanish';

  @override
  String get languageRussian => 'Russian';

  @override
  String get languageKorean => 'Korean';

  @override
  String get languageFrench => 'French';

  @override
  String get languageJapanese => 'Japanese';

  @override
  String get languagePortuguese => 'Portuguese';

  @override
  String get languageTurkish => 'Turkish';

  @override
  String get languagePolish => 'Polish';

  @override
  String get languageCatalan => 'Catalan';

  @override
  String get languageDutch => 'Dutch';

  @override
  String get languageArabic => 'Arabic';

  @override
  String get languageSwedish => 'Swedish';

  @override
  String get languageItalian => 'Italian';

  @override
  String get languageIndonesian => 'Indonesian';

  @override
  String get languageHindi => 'Hindi';

  @override
  String get languageFinnish => 'Finnish';

  @override
  String get languageVietnamese => 'Vietnamese';

  @override
  String get languageHebrew => 'Hebrew';

  @override
  String get languageUkrainian => 'Ukrainian';

  @override
  String get languageGreek => 'Greek';

  @override
  String get languageMalay => 'Malay';

  @override
  String get languageCzech => 'Czech';

  @override
  String get languageRomanian => 'Romanian';

  @override
  String get languageDanish => 'Danish';

  @override
  String get languageHungarian => 'Hungarian';

  @override
  String get languageTamil => 'Tamil';

  @override
  String get languageNorwegian => 'Norwegian';

  @override
  String get languageThai => 'Thai';

  @override
  String get languageUrdu => 'Urdu';

  @override
  String get languageCroatian => 'Croatian';

  @override
  String get languageBulgarian => 'Bulgarian';

  @override
  String get languageLithuanian => 'Lithuanian';

  @override
  String get languageLatin => 'Latin';

  @override
  String get languageMaori => 'Maori';

  @override
  String get languageMalayalam => 'Malayalam';

  @override
  String get languageWelsh => 'Welsh';

  @override
  String get languageSlovak => 'Slovak';

  @override
  String get languageTelugu => 'Telugu';

  @override
  String get languagePersian => 'Persian';

  @override
  String get languageLatvian => 'Latvian';

  @override
  String get languageBengali => 'Bengali';

  @override
  String get languageSerbian => 'Serbian';

  @override
  String get languageAzerbaijani => 'Azerbaijani';

  @override
  String get languageSlovenian => 'Slovenian';

  @override
  String get languageKannada => 'Kannada';

  @override
  String get languageEstonian => 'Estonian';

  @override
  String get languageMacedonian => 'Macedonian';

  @override
  String get languageBreton => 'Breton';

  @override
  String get languageBasque => 'Basque';

  @override
  String get languageIcelandic => 'Icelandic';

  @override
  String get languageArmenian => 'Armenian';

  @override
  String get languageNepali => 'Nepali';

  @override
  String get languageMongolian => 'Mongolian';

  @override
  String get languageBosnian => 'Bosnian';

  @override
  String get languageKazakh => 'Kazakh';

  @override
  String get languageAlbanian => 'Albanian';

  @override
  String get languageSwahili => 'Swahili';

  @override
  String get languageGalician => 'Galician';

  @override
  String get languageMarathi => 'Marathi';

  @override
  String get languagePunjabi => 'Punjabi';

  @override
  String get languageSinhala => 'Sinhala';

  @override
  String get languageKhmer => 'Khmer';

  @override
  String get languageShona => 'Shona';

  @override
  String get languageYoruba => 'Yoruba';

  @override
  String get languageSomali => 'Somali';

  @override
  String get languageAfrikaans => 'Afrikaans';

  @override
  String get languageOccitan => 'Occitan';

  @override
  String get languageGeorgian => 'Georgian';

  @override
  String get languageBelarusian => 'Belarusian';

  @override
  String get languageTajik => 'Tajik';

  @override
  String get languageSindhi => 'Sindhi';

  @override
  String get languageGujarati => 'Gujarati';

  @override
  String get languageAmharic => 'Amharic';

  @override
  String get languageYiddish => 'Yiddish';

  @override
  String get languageLao => 'Lao';

  @override
  String get languageUzbek => 'Uzbek';

  @override
  String get languageFaroese => 'Faroese';

  @override
  String get languageHaitianCreole => 'Haitian Creole';

  @override
  String get languagePashto => 'Pashto';

  @override
  String get languageTurkmen => 'Turkmen';

  @override
  String get languageNynorsk => 'Nynorsk';

  @override
  String get languageMaltese => 'Maltese';

  @override
  String get languageSanskrit => 'Sanskrit';

  @override
  String get languageLuxembourgish => 'Luxembourgish';

  @override
  String get languageMyanmar => 'Myanmar';

  @override
  String get languageTibetan => 'Tibetan';

  @override
  String get languageTagalog => 'Tagalog';

  @override
  String get languageMalagasy => 'Malagasy';

  @override
  String get languageAssamese => 'Assamese';

  @override
  String get languageTatar => 'Tatar';

  @override
  String get languageHawaiian => 'Hawaiian';

  @override
  String get languageLingala => 'Lingala';

  @override
  String get languageHausa => 'Hausa';

  @override
  String get languageBashkir => 'Bashkir';

  @override
  String get languageJavanese => 'Javanese';

  @override
  String get languageSundanese => 'Sundanese';
}
