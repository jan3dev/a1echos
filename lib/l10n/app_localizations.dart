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
  /// **'Are you sure you want to delete {count} {sessions}? This action cannot be undone.'**
  String homeDeleteSelectedSessionsMessage(Object count, Object sessions);

  /// No description provided for @homeSessionsDeleted.
  ///
  /// In en, this message translates to:
  /// **'{sessions} deleted'**
  String homeSessionsDeleted(Object sessions);

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
  /// **'Are you sure you want to delete {count} {transcriptions}? This action cannot be undone.'**
  String sessionDeleteTranscriptionsMessage(
    Object count,
    Object transcriptions,
  );

  /// No description provided for @sessionTranscriptionsDeleted.
  ///
  /// In en, this message translates to:
  /// **'{transcriptions} deleted'**
  String sessionTranscriptionsDeleted(Object transcriptions);

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
  /// **'Transcibe without saving. This session won\'t be stored or synced anywhere.'**
  String get incognitoExplainerBody;

  /// No description provided for @incognitoExplainerCta.
  ///
  /// In en, this message translates to:
  /// **'Got it!'**
  String get incognitoExplainerCta;
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
