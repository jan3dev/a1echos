import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[Locale('en')];

  /// No description provided for @loading.
  ///
  /// In en, this message translates to:
  /// **'Loading...'**
  String get loading;

  /// No description provided for @transcribingStatus.
  ///
  /// In en, this message translates to:
  /// **'Transcribing...'**
  String get transcribingStatus;

  /// No description provided for @liveTranscriptionTitle.
  ///
  /// In en, this message translates to:
  /// **'Live Transcription'**
  String get liveTranscriptionTitle;

  /// No description provided for @speakNow.
  ///
  /// In en, this message translates to:
  /// **'Speak now...'**
  String get speakNow;

  /// No description provided for @encryptedAtRest.
  ///
  /// In en, this message translates to:
  /// **'Encrypted at rest'**
  String get encryptedAtRest;

  /// No description provided for @save.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get save;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @ok.
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get ok;

  /// No description provided for @delete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get delete;

  /// No description provided for @clear.
  ///
  /// In en, this message translates to:
  /// **'Delete All Transcriptions'**
  String get clear;

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retry;

  /// No description provided for @share.
  ///
  /// In en, this message translates to:
  /// **'Share'**
  String get share;

  /// No description provided for @edit.
  ///
  /// In en, this message translates to:
  /// **'Edit'**
  String get edit;

  /// No description provided for @homeDeleteSelectedSessionsTitle.
  ///
  /// In en, this message translates to:
  /// **'Delete?'**
  String get homeDeleteSelectedSessionsTitle;

  /// No description provided for @homeDeleteSelectedSessionsMessage.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to delete {count,plural, =1{1 session} other{{count} sessions}}? This action cannot be undone.'**
  String homeDeleteSelectedSessionsMessage(int count);

  /// No description provided for @homeSessionsDeleted.
  ///
  /// In en, this message translates to:
  /// **'{count,plural, =1{1 session deleted} other{{count} sessions deleted}}'**
  String homeSessionsDeleted(int count);

  /// No description provided for @homeErrorCreatingSession.
  ///
  /// In en, this message translates to:
  /// **'Error creating session: {error}'**
  String homeErrorCreatingSession(Object error);

  /// No description provided for @clearAllTooltip.
  ///
  /// In en, this message translates to:
  /// **'Clear All'**
  String get clearAllTooltip;

  /// No description provided for @newSessionTooltip.
  ///
  /// In en, this message translates to:
  /// **'New Session'**
  String get newSessionTooltip;

  /// No description provided for @sessionRenameTitle.
  ///
  /// In en, this message translates to:
  /// **'Rename'**
  String get sessionRenameTitle;

  /// No description provided for @sessionDeleteTranscriptionsTitle.
  ///
  /// In en, this message translates to:
  /// **'Delete?'**
  String get sessionDeleteTranscriptionsTitle;

  /// No description provided for @sessionDeleteTranscriptionsMessage.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to delete {count,plural, =1{1 transcription} other{{count} transcriptions}}? This action cannot be undone.'**
  String sessionDeleteTranscriptionsMessage(int count);

  /// No description provided for @sessionTranscriptionsDeleted.
  ///
  /// In en, this message translates to:
  /// **'{count,plural, =1{1 transcription deleted} other{{count} transcriptions deleted}}'**
  String sessionTranscriptionsDeleted(int count);

  /// No description provided for @sessionErrorDeletingTranscriptions.
  ///
  /// In en, this message translates to:
  /// **'Error deleting {transcriptions}: {error}'**
  String sessionErrorDeletingTranscriptions(
    Object transcriptions,
    Object error,
  );

  /// No description provided for @noTranscriptionsToCopy.
  ///
  /// In en, this message translates to:
  /// **'No transcriptions to copy'**
  String get noTranscriptionsToCopy;

  /// No description provided for @allTranscriptionsCopied.
  ///
  /// In en, this message translates to:
  /// **'All transcriptions copied to clipboard'**
  String get allTranscriptionsCopied;

  /// No description provided for @noTranscriptionsToClear.
  ///
  /// In en, this message translates to:
  /// **'No transcriptions to clear'**
  String get noTranscriptionsToClear;

  /// No description provided for @allTranscriptionsClearedSession.
  ///
  /// In en, this message translates to:
  /// **'All transcriptions cleared for this session'**
  String get allTranscriptionsClearedSession;

  /// No description provided for @copiedToClipboard.
  ///
  /// In en, this message translates to:
  /// **'Copied to clipboard'**
  String get copiedToClipboard;

  /// No description provided for @retryInitialization.
  ///
  /// In en, this message translates to:
  /// **'Retry Initialization'**
  String get retryInitialization;

  /// No description provided for @modelNotReady.
  ///
  /// In en, this message translates to:
  /// **'Model Not Ready'**
  String get modelNotReady;

  /// No description provided for @modelInitFailure.
  ///
  /// In en, this message translates to:
  /// **'The selected speech recognition model failed to initialize. Please check settings, ensure model files are present, and restart the app.'**
  String get modelInitFailure;

  /// No description provided for @settingsTitle.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settingsTitle;

  /// No description provided for @modelTitle.
  ///
  /// In en, this message translates to:
  /// **'Model'**
  String get modelTitle;

  /// No description provided for @themeTitle.
  ///
  /// In en, this message translates to:
  /// **'Theme'**
  String get themeTitle;

  /// No description provided for @auto.
  ///
  /// In en, this message translates to:
  /// **'Auto'**
  String get auto;

  /// No description provided for @light.
  ///
  /// In en, this message translates to:
  /// **'Light'**
  String get light;

  /// No description provided for @dark.
  ///
  /// In en, this message translates to:
  /// **'Dark'**
  String get dark;

  /// No description provided for @modelDescription.
  ///
  /// In en, this message translates to:
  /// **'Select which model to use. All processing happens on your device.'**
  String get modelDescription;

  /// No description provided for @voskModelTitle.
  ///
  /// In en, this message translates to:
  /// **'Vosk'**
  String get voskModelTitle;

  /// No description provided for @voskModelSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Fast, real-time'**
  String get voskModelSubtitle;

  /// No description provided for @whisperModelTitle.
  ///
  /// In en, this message translates to:
  /// **'Whisper'**
  String get whisperModelTitle;

  /// No description provided for @whisperModelRealtimeTitle.
  ///
  /// In en, this message translates to:
  /// **'Whisper (Real-time)'**
  String get whisperModelRealtimeTitle;

  /// No description provided for @whisperModelFileTitle.
  ///
  /// In en, this message translates to:
  /// **'Whisper'**
  String get whisperModelFileTitle;

  /// No description provided for @whisperModelSubtitle.
  ///
  /// In en, this message translates to:
  /// **'High accuracy'**
  String get whisperModelSubtitle;

  /// No description provided for @followUs.
  ///
  /// In en, this message translates to:
  /// **'Follow us on X'**
  String get followUs;

  /// No description provided for @recordingPrefix.
  ///
  /// In en, this message translates to:
  /// **'Session'**
  String get recordingPrefix;

  /// No description provided for @emptySessionsMessage.
  ///
  /// In en, this message translates to:
  /// **'Hit the record button to start transcribing'**
  String get emptySessionsMessage;

  /// No description provided for @copyToClipboard.
  ///
  /// In en, this message translates to:
  /// **'Copied to clipboard'**
  String get copyToClipboard;

  /// No description provided for @modifiedPrefix.
  ///
  /// In en, this message translates to:
  /// **'Modified'**
  String get modifiedPrefix;

  /// No description provided for @errorPrefix.
  ///
  /// In en, this message translates to:
  /// **'Error:'**
  String get errorPrefix;

  /// No description provided for @sessionNameLabel.
  ///
  /// In en, this message translates to:
  /// **'Session Name'**
  String get sessionNameLabel;

  /// No description provided for @sessionNameMaxLengthHelper.
  ///
  /// In en, this message translates to:
  /// **'Max 30 characters.'**
  String get sessionNameMaxLengthHelper;

  /// No description provided for @modelReadySuffix.
  ///
  /// In en, this message translates to:
  /// **'model is ready.'**
  String get modelReadySuffix;

  /// No description provided for @modelFailedInitSuffix.
  ///
  /// In en, this message translates to:
  /// **'model failed to initialize.'**
  String get modelFailedInitSuffix;

  /// No description provided for @initializingModelPrefix.
  ///
  /// In en, this message translates to:
  /// **'Initializing'**
  String get initializingModelPrefix;

  /// No description provided for @modelSuffix.
  ///
  /// In en, this message translates to:
  /// **'model...'**
  String get modelSuffix;

  /// No description provided for @retryInitializationButton.
  ///
  /// In en, this message translates to:
  /// **'Retry Initialization'**
  String get retryInitializationButton;

  /// No description provided for @incognitoModeTitle.
  ///
  /// In en, this message translates to:
  /// **'Incognito'**
  String get incognitoModeTitle;

  /// No description provided for @incognitoExplainerTitle.
  ///
  /// In en, this message translates to:
  /// **'Incognito Mode'**
  String get incognitoExplainerTitle;

  /// No description provided for @incognitoExplainerBody.
  ///
  /// In en, this message translates to:
  /// **'Transcribe without saving. This session won\'t be stored or synced anywhere.'**
  String get incognitoExplainerBody;

  /// No description provided for @incognitoExplainerCta.
  ///
  /// In en, this message translates to:
  /// **'Got it!'**
  String get incognitoExplainerCta;

  /// No description provided for @copyFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to copy: {error}'**
  String copyFailed(Object error);

  /// No description provided for @noTranscriptionsSelectedToShare.
  ///
  /// In en, this message translates to:
  /// **'No transcriptions selected to share'**
  String get noTranscriptionsSelectedToShare;

  /// No description provided for @shareFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to share: {error}'**
  String shareFailed(Object error);

  /// No description provided for @actionFailedTitle.
  ///
  /// In en, this message translates to:
  /// **'{action} Failed'**
  String actionFailedTitle(Object action);

  /// No description provided for @genericErrorRetry.
  ///
  /// In en, this message translates to:
  /// **'An error occurred: {error}\\n\\nPlease try again in a moment.'**
  String genericErrorRetry(Object error);

  /// No description provided for @couldNotOpenLink.
  ///
  /// In en, this message translates to:
  /// **'Could not open link'**
  String get couldNotOpenLink;

  /// No description provided for @createdPrefix.
  ///
  /// In en, this message translates to:
  /// **'Created'**
  String get createdPrefix;

  /// No description provided for @spokenLanguageTitle.
  ///
  /// In en, this message translates to:
  /// **'Spoken Language'**
  String get spokenLanguageTitle;

  /// No description provided for @spokenLanguageDescription.
  ///
  /// In en, this message translates to:
  /// **'Choose which language the model should detect. For best results, select the language you mainly speak.'**
  String get spokenLanguageDescription;

  /// No description provided for @spokenLanguageDisabledForVosk.
  ///
  /// In en, this message translates to:
  /// **'Language selection is only available for Whisper models. Vosk only supports English.'**
  String get spokenLanguageDisabledForVosk;

  /// No description provided for @languageEnglish.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get languageEnglish;

  /// No description provided for @languageChinese.
  ///
  /// In en, this message translates to:
  /// **'Chinese'**
  String get languageChinese;

  /// No description provided for @languageGerman.
  ///
  /// In en, this message translates to:
  /// **'German'**
  String get languageGerman;

  /// No description provided for @languageSpanish.
  ///
  /// In en, this message translates to:
  /// **'Spanish'**
  String get languageSpanish;

  /// No description provided for @languageRussian.
  ///
  /// In en, this message translates to:
  /// **'Russian'**
  String get languageRussian;

  /// No description provided for @languageKorean.
  ///
  /// In en, this message translates to:
  /// **'Korean'**
  String get languageKorean;

  /// No description provided for @languageFrench.
  ///
  /// In en, this message translates to:
  /// **'French'**
  String get languageFrench;

  /// No description provided for @languageJapanese.
  ///
  /// In en, this message translates to:
  /// **'Japanese'**
  String get languageJapanese;

  /// No description provided for @languagePortuguese.
  ///
  /// In en, this message translates to:
  /// **'Portuguese'**
  String get languagePortuguese;

  /// No description provided for @languageTurkish.
  ///
  /// In en, this message translates to:
  /// **'Turkish'**
  String get languageTurkish;

  /// No description provided for @languagePolish.
  ///
  /// In en, this message translates to:
  /// **'Polish'**
  String get languagePolish;

  /// No description provided for @languageCatalan.
  ///
  /// In en, this message translates to:
  /// **'Catalan'**
  String get languageCatalan;

  /// No description provided for @languageDutch.
  ///
  /// In en, this message translates to:
  /// **'Dutch'**
  String get languageDutch;

  /// No description provided for @languageArabic.
  ///
  /// In en, this message translates to:
  /// **'Arabic'**
  String get languageArabic;

  /// No description provided for @languageSwedish.
  ///
  /// In en, this message translates to:
  /// **'Swedish'**
  String get languageSwedish;

  /// No description provided for @languageItalian.
  ///
  /// In en, this message translates to:
  /// **'Italian'**
  String get languageItalian;

  /// No description provided for @languageIndonesian.
  ///
  /// In en, this message translates to:
  /// **'Indonesian'**
  String get languageIndonesian;

  /// No description provided for @languageHindi.
  ///
  /// In en, this message translates to:
  /// **'Hindi'**
  String get languageHindi;

  /// No description provided for @languageFinnish.
  ///
  /// In en, this message translates to:
  /// **'Finnish'**
  String get languageFinnish;

  /// No description provided for @languageVietnamese.
  ///
  /// In en, this message translates to:
  /// **'Vietnamese'**
  String get languageVietnamese;

  /// No description provided for @languageHebrew.
  ///
  /// In en, this message translates to:
  /// **'Hebrew'**
  String get languageHebrew;

  /// No description provided for @languageUkrainian.
  ///
  /// In en, this message translates to:
  /// **'Ukrainian'**
  String get languageUkrainian;

  /// No description provided for @languageGreek.
  ///
  /// In en, this message translates to:
  /// **'Greek'**
  String get languageGreek;

  /// No description provided for @languageMalay.
  ///
  /// In en, this message translates to:
  /// **'Malay'**
  String get languageMalay;

  /// No description provided for @languageCzech.
  ///
  /// In en, this message translates to:
  /// **'Czech'**
  String get languageCzech;

  /// No description provided for @languageRomanian.
  ///
  /// In en, this message translates to:
  /// **'Romanian'**
  String get languageRomanian;

  /// No description provided for @languageDanish.
  ///
  /// In en, this message translates to:
  /// **'Danish'**
  String get languageDanish;

  /// No description provided for @languageHungarian.
  ///
  /// In en, this message translates to:
  /// **'Hungarian'**
  String get languageHungarian;

  /// No description provided for @languageTamil.
  ///
  /// In en, this message translates to:
  /// **'Tamil'**
  String get languageTamil;

  /// No description provided for @languageNorwegian.
  ///
  /// In en, this message translates to:
  /// **'Norwegian'**
  String get languageNorwegian;

  /// No description provided for @languageThai.
  ///
  /// In en, this message translates to:
  /// **'Thai'**
  String get languageThai;

  /// No description provided for @languageUrdu.
  ///
  /// In en, this message translates to:
  /// **'Urdu'**
  String get languageUrdu;

  /// No description provided for @languageCroatian.
  ///
  /// In en, this message translates to:
  /// **'Croatian'**
  String get languageCroatian;

  /// No description provided for @languageBulgarian.
  ///
  /// In en, this message translates to:
  /// **'Bulgarian'**
  String get languageBulgarian;

  /// No description provided for @languageLithuanian.
  ///
  /// In en, this message translates to:
  /// **'Lithuanian'**
  String get languageLithuanian;

  /// No description provided for @languageLatin.
  ///
  /// In en, this message translates to:
  /// **'Latin'**
  String get languageLatin;

  /// No description provided for @languageMaori.
  ///
  /// In en, this message translates to:
  /// **'Maori'**
  String get languageMaori;

  /// No description provided for @languageMalayalam.
  ///
  /// In en, this message translates to:
  /// **'Malayalam'**
  String get languageMalayalam;

  /// No description provided for @languageWelsh.
  ///
  /// In en, this message translates to:
  /// **'Welsh'**
  String get languageWelsh;

  /// No description provided for @languageSlovak.
  ///
  /// In en, this message translates to:
  /// **'Slovak'**
  String get languageSlovak;

  /// No description provided for @languageTelugu.
  ///
  /// In en, this message translates to:
  /// **'Telugu'**
  String get languageTelugu;

  /// No description provided for @languagePersian.
  ///
  /// In en, this message translates to:
  /// **'Persian'**
  String get languagePersian;

  /// No description provided for @languageLatvian.
  ///
  /// In en, this message translates to:
  /// **'Latvian'**
  String get languageLatvian;

  /// No description provided for @languageBengali.
  ///
  /// In en, this message translates to:
  /// **'Bengali'**
  String get languageBengali;

  /// No description provided for @languageSerbian.
  ///
  /// In en, this message translates to:
  /// **'Serbian'**
  String get languageSerbian;

  /// No description provided for @languageAzerbaijani.
  ///
  /// In en, this message translates to:
  /// **'Azerbaijani'**
  String get languageAzerbaijani;

  /// No description provided for @languageSlovenian.
  ///
  /// In en, this message translates to:
  /// **'Slovenian'**
  String get languageSlovenian;

  /// No description provided for @languageKannada.
  ///
  /// In en, this message translates to:
  /// **'Kannada'**
  String get languageKannada;

  /// No description provided for @languageEstonian.
  ///
  /// In en, this message translates to:
  /// **'Estonian'**
  String get languageEstonian;

  /// No description provided for @languageMacedonian.
  ///
  /// In en, this message translates to:
  /// **'Macedonian'**
  String get languageMacedonian;

  /// No description provided for @languageBreton.
  ///
  /// In en, this message translates to:
  /// **'Breton'**
  String get languageBreton;

  /// No description provided for @languageBasque.
  ///
  /// In en, this message translates to:
  /// **'Basque'**
  String get languageBasque;

  /// No description provided for @languageIcelandic.
  ///
  /// In en, this message translates to:
  /// **'Icelandic'**
  String get languageIcelandic;

  /// No description provided for @languageArmenian.
  ///
  /// In en, this message translates to:
  /// **'Armenian'**
  String get languageArmenian;

  /// No description provided for @languageNepali.
  ///
  /// In en, this message translates to:
  /// **'Nepali'**
  String get languageNepali;

  /// No description provided for @languageMongolian.
  ///
  /// In en, this message translates to:
  /// **'Mongolian'**
  String get languageMongolian;

  /// No description provided for @languageBosnian.
  ///
  /// In en, this message translates to:
  /// **'Bosnian'**
  String get languageBosnian;

  /// No description provided for @languageKazakh.
  ///
  /// In en, this message translates to:
  /// **'Kazakh'**
  String get languageKazakh;

  /// No description provided for @languageAlbanian.
  ///
  /// In en, this message translates to:
  /// **'Albanian'**
  String get languageAlbanian;

  /// No description provided for @languageSwahili.
  ///
  /// In en, this message translates to:
  /// **'Swahili'**
  String get languageSwahili;

  /// No description provided for @languageGalician.
  ///
  /// In en, this message translates to:
  /// **'Galician'**
  String get languageGalician;

  /// No description provided for @languageMarathi.
  ///
  /// In en, this message translates to:
  /// **'Marathi'**
  String get languageMarathi;

  /// No description provided for @languagePunjabi.
  ///
  /// In en, this message translates to:
  /// **'Punjabi'**
  String get languagePunjabi;

  /// No description provided for @languageSinhala.
  ///
  /// In en, this message translates to:
  /// **'Sinhala'**
  String get languageSinhala;

  /// No description provided for @languageKhmer.
  ///
  /// In en, this message translates to:
  /// **'Khmer'**
  String get languageKhmer;

  /// No description provided for @languageShona.
  ///
  /// In en, this message translates to:
  /// **'Shona'**
  String get languageShona;

  /// No description provided for @languageYoruba.
  ///
  /// In en, this message translates to:
  /// **'Yoruba'**
  String get languageYoruba;

  /// No description provided for @languageSomali.
  ///
  /// In en, this message translates to:
  /// **'Somali'**
  String get languageSomali;

  /// No description provided for @languageAfrikaans.
  ///
  /// In en, this message translates to:
  /// **'Afrikaans'**
  String get languageAfrikaans;

  /// No description provided for @languageOccitan.
  ///
  /// In en, this message translates to:
  /// **'Occitan'**
  String get languageOccitan;

  /// No description provided for @languageGeorgian.
  ///
  /// In en, this message translates to:
  /// **'Georgian'**
  String get languageGeorgian;

  /// No description provided for @languageBelarusian.
  ///
  /// In en, this message translates to:
  /// **'Belarusian'**
  String get languageBelarusian;

  /// No description provided for @languageTajik.
  ///
  /// In en, this message translates to:
  /// **'Tajik'**
  String get languageTajik;

  /// No description provided for @languageSindhi.
  ///
  /// In en, this message translates to:
  /// **'Sindhi'**
  String get languageSindhi;

  /// No description provided for @languageGujarati.
  ///
  /// In en, this message translates to:
  /// **'Gujarati'**
  String get languageGujarati;

  /// No description provided for @languageAmharic.
  ///
  /// In en, this message translates to:
  /// **'Amharic'**
  String get languageAmharic;

  /// No description provided for @languageYiddish.
  ///
  /// In en, this message translates to:
  /// **'Yiddish'**
  String get languageYiddish;

  /// No description provided for @languageLao.
  ///
  /// In en, this message translates to:
  /// **'Lao'**
  String get languageLao;

  /// No description provided for @languageUzbek.
  ///
  /// In en, this message translates to:
  /// **'Uzbek'**
  String get languageUzbek;

  /// No description provided for @languageFaroese.
  ///
  /// In en, this message translates to:
  /// **'Faroese'**
  String get languageFaroese;

  /// No description provided for @languageHaitianCreole.
  ///
  /// In en, this message translates to:
  /// **'Haitian Creole'**
  String get languageHaitianCreole;

  /// No description provided for @languagePashto.
  ///
  /// In en, this message translates to:
  /// **'Pashto'**
  String get languagePashto;

  /// No description provided for @languageTurkmen.
  ///
  /// In en, this message translates to:
  /// **'Turkmen'**
  String get languageTurkmen;

  /// No description provided for @languageNynorsk.
  ///
  /// In en, this message translates to:
  /// **'Nynorsk'**
  String get languageNynorsk;

  /// No description provided for @languageMaltese.
  ///
  /// In en, this message translates to:
  /// **'Maltese'**
  String get languageMaltese;

  /// No description provided for @languageSanskrit.
  ///
  /// In en, this message translates to:
  /// **'Sanskrit'**
  String get languageSanskrit;

  /// No description provided for @languageLuxembourgish.
  ///
  /// In en, this message translates to:
  /// **'Luxembourgish'**
  String get languageLuxembourgish;

  /// No description provided for @languageMyanmar.
  ///
  /// In en, this message translates to:
  /// **'Myanmar'**
  String get languageMyanmar;

  /// No description provided for @languageTibetan.
  ///
  /// In en, this message translates to:
  /// **'Tibetan'**
  String get languageTibetan;

  /// No description provided for @languageTagalog.
  ///
  /// In en, this message translates to:
  /// **'Tagalog'**
  String get languageTagalog;

  /// No description provided for @languageMalagasy.
  ///
  /// In en, this message translates to:
  /// **'Malagasy'**
  String get languageMalagasy;

  /// No description provided for @languageAssamese.
  ///
  /// In en, this message translates to:
  /// **'Assamese'**
  String get languageAssamese;

  /// No description provided for @languageTatar.
  ///
  /// In en, this message translates to:
  /// **'Tatar'**
  String get languageTatar;

  /// No description provided for @languageHawaiian.
  ///
  /// In en, this message translates to:
  /// **'Hawaiian'**
  String get languageHawaiian;

  /// No description provided for @languageLingala.
  ///
  /// In en, this message translates to:
  /// **'Lingala'**
  String get languageLingala;

  /// No description provided for @languageHausa.
  ///
  /// In en, this message translates to:
  /// **'Hausa'**
  String get languageHausa;

  /// No description provided for @languageBashkir.
  ///
  /// In en, this message translates to:
  /// **'Bashkir'**
  String get languageBashkir;

  /// No description provided for @languageJavanese.
  ///
  /// In en, this message translates to:
  /// **'Javanese'**
  String get languageJavanese;

  /// No description provided for @languageSundanese.
  ///
  /// In en, this message translates to:
  /// **'Sundanese'**
  String get languageSundanese;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
