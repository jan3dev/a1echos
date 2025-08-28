import 'package:flutter/material.dart';
import '../l10n/app_localizations.dart';

class SpokenLanguage {
  final String code;

  const SpokenLanguage({required this.code});

  /// Asset path to the SVG flag icon for this language
  String get flagAssetPath => SupportedLanguages.flagAssetFor(code);

  /// Get the localized name for this language
  String getName(BuildContext context) {
    final loc = AppLocalizations.of(context)!;
    return SupportedLanguages.localizedNameFor(code, loc);
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is SpokenLanguage && other.code == code;
  }

  @override
  int get hashCode => code.hashCode;

  @override
  String toString() => 'SpokenLanguage(code: $code)';
}

class _LanguageInfo {
  final String flagAssetFilename;
  final String Function(AppLocalizations) nameSelector;

  const _LanguageInfo({
    required this.flagAssetFilename,
    required this.nameSelector,
  });
}

class SupportedLanguages {
  static final Map<String, _LanguageInfo> _languageData = {
    'en': _LanguageInfo(
      flagAssetFilename: 'english',
      nameSelector: (loc) => loc.languageEnglish,
    ),
    'zh': _LanguageInfo(
      flagAssetFilename: 'chinese',
      nameSelector: (loc) => loc.languageChinese,
    ),
    'de': _LanguageInfo(
      flagAssetFilename: 'german',
      nameSelector: (loc) => loc.languageGerman,
    ),
    'es': _LanguageInfo(
      flagAssetFilename: 'spanish',
      nameSelector: (loc) => loc.languageSpanish,
    ),
    'ru': _LanguageInfo(
      flagAssetFilename: 'russian',
      nameSelector: (loc) => loc.languageRussian,
    ),
    'ko': _LanguageInfo(
      flagAssetFilename: 'korean',
      nameSelector: (loc) => loc.languageKorean,
    ),
    'fr': _LanguageInfo(
      flagAssetFilename: 'french',
      nameSelector: (loc) => loc.languageFrench,
    ),
    'ja': _LanguageInfo(
      flagAssetFilename: 'japanese',
      nameSelector: (loc) => loc.languageJapanese,
    ),
    'pt': _LanguageInfo(
      flagAssetFilename: 'portuguese',
      nameSelector: (loc) => loc.languagePortuguese,
    ),
    'tr': _LanguageInfo(
      flagAssetFilename: 'turkish',
      nameSelector: (loc) => loc.languageTurkish,
    ),
    'pl': _LanguageInfo(
      flagAssetFilename: 'polish',
      nameSelector: (loc) => loc.languagePolish,
    ),
    'ca': _LanguageInfo(
      flagAssetFilename: 'spanish',
      nameSelector: (loc) => loc.languageCatalan,
    ), // Catalan uses Spanish flag
    'nl': _LanguageInfo(
      flagAssetFilename: 'dutch',
      nameSelector: (loc) => loc.languageDutch,
    ),
    'ar': _LanguageInfo(
      flagAssetFilename: 'arabic',
      nameSelector: (loc) => loc.languageArabic,
    ),
    'sv': _LanguageInfo(
      flagAssetFilename: 'swedish',
      nameSelector: (loc) => loc.languageSwedish,
    ),
    'it': _LanguageInfo(
      flagAssetFilename: 'italian',
      nameSelector: (loc) => loc.languageItalian,
    ),
    'id': _LanguageInfo(
      flagAssetFilename: 'indonesian',
      nameSelector: (loc) => loc.languageIndonesian,
    ),
    'hi': _LanguageInfo(
      flagAssetFilename: 'hindi',
      nameSelector: (loc) => loc.languageHindi,
    ),
    'fi': _LanguageInfo(
      flagAssetFilename: 'finnish',
      nameSelector: (loc) => loc.languageFinnish,
    ),
    'vi': _LanguageInfo(
      flagAssetFilename: 'vietnamese',
      nameSelector: (loc) => loc.languageVietnamese,
    ),
    'he': _LanguageInfo(
      flagAssetFilename: 'hebrew',
      nameSelector: (loc) => loc.languageHebrew,
    ),
    'uk': _LanguageInfo(
      flagAssetFilename: 'ukrainian',
      nameSelector: (loc) => loc.languageUkrainian,
    ),
    'el': _LanguageInfo(
      flagAssetFilename: 'greek',
      nameSelector: (loc) => loc.languageGreek,
    ),
    'ms': _LanguageInfo(
      flagAssetFilename: 'malay',
      nameSelector: (loc) => loc.languageMalay,
    ),
    'cs': _LanguageInfo(
      flagAssetFilename: 'czech',
      nameSelector: (loc) => loc.languageCzech,
    ),
    'ro': _LanguageInfo(
      flagAssetFilename: 'romanian',
      nameSelector: (loc) => loc.languageRomanian,
    ),
    'da': _LanguageInfo(
      flagAssetFilename: 'danish',
      nameSelector: (loc) => loc.languageDanish,
    ),
    'hu': _LanguageInfo(
      flagAssetFilename: 'hungarian',
      nameSelector: (loc) => loc.languageHungarian,
    ),
    'ta': _LanguageInfo(
      flagAssetFilename: 'hindi',
      nameSelector: (loc) => loc.languageTamil,
    ), // Tamil uses Hindi flag
    'no': _LanguageInfo(
      flagAssetFilename: 'norwegian',
      nameSelector: (loc) => loc.languageNorwegian,
    ),
    'th': _LanguageInfo(
      flagAssetFilename: 'thai',
      nameSelector: (loc) => loc.languageThai,
    ),
    'ur': _LanguageInfo(
      flagAssetFilename: 'urdu',
      nameSelector: (loc) => loc.languageUrdu,
    ),
    'hr': _LanguageInfo(
      flagAssetFilename: 'croatian',
      nameSelector: (loc) => loc.languageCroatian,
    ),
    'bg': _LanguageInfo(
      flagAssetFilename: 'bulgarian',
      nameSelector: (loc) => loc.languageBulgarian,
    ),
    'lt': _LanguageInfo(
      flagAssetFilename: 'lithuanian',
      nameSelector: (loc) => loc.languageLithuanian,
    ),
    'la': _LanguageInfo(
      flagAssetFilename: 'latin',
      nameSelector: (loc) => loc.languageLatin,
    ),
    'mi': _LanguageInfo(
      flagAssetFilename: 'maori',
      nameSelector: (loc) => loc.languageMaori,
    ),
    'ml': _LanguageInfo(
      flagAssetFilename: 'hindi',
      nameSelector: (loc) => loc.languageMalayalam,
    ), // Malayalam uses Hindi flag
    'cy': _LanguageInfo(
      flagAssetFilename: 'welsh',
      nameSelector: (loc) => loc.languageWelsh,
    ),
    'sk': _LanguageInfo(
      flagAssetFilename: 'slovak',
      nameSelector: (loc) => loc.languageSlovak,
    ),
    'te': _LanguageInfo(
      flagAssetFilename: 'hindi',
      nameSelector: (loc) => loc.languageTelugu,
    ), // Telugu uses Hindi flag
    'fa': _LanguageInfo(
      flagAssetFilename: 'persian',
      nameSelector: (loc) => loc.languagePersian,
    ),
    'lv': _LanguageInfo(
      flagAssetFilename: 'latvian',
      nameSelector: (loc) => loc.languageLatvian,
    ),
    'bn': _LanguageInfo(
      flagAssetFilename: 'bengali',
      nameSelector: (loc) => loc.languageBengali,
    ),
    'sr': _LanguageInfo(
      flagAssetFilename: 'serbian',
      nameSelector: (loc) => loc.languageSerbian,
    ),
    'az': _LanguageInfo(
      flagAssetFilename: 'azerbaijani',
      nameSelector: (loc) => loc.languageAzerbaijani,
    ),
    'sl': _LanguageInfo(
      flagAssetFilename: 'slovenian',
      nameSelector: (loc) => loc.languageSlovenian,
    ),
    'kn': _LanguageInfo(
      flagAssetFilename: 'hindi',
      nameSelector: (loc) => loc.languageKannada,
    ), // Kannada uses Hindi flag
    'et': _LanguageInfo(
      flagAssetFilename: 'estonian',
      nameSelector: (loc) => loc.languageEstonian,
    ),
    'mk': _LanguageInfo(
      flagAssetFilename: 'macedonian',
      nameSelector: (loc) => loc.languageMacedonian,
    ),
    'br': _LanguageInfo(
      flagAssetFilename: 'french',
      nameSelector: (loc) => loc.languageBreton,
    ), // Breton uses French flag
    'eu': _LanguageInfo(
      flagAssetFilename: 'spanish',
      nameSelector: (loc) => loc.languageBasque,
    ), // Basque uses Spanish flag
    'is': _LanguageInfo(
      flagAssetFilename: 'icelandic',
      nameSelector: (loc) => loc.languageIcelandic,
    ),
    'hy': _LanguageInfo(
      flagAssetFilename: 'armenian',
      nameSelector: (loc) => loc.languageArmenian,
    ),
    'ne': _LanguageInfo(
      flagAssetFilename: 'nepali',
      nameSelector: (loc) => loc.languageNepali,
    ),
    'mn': _LanguageInfo(
      flagAssetFilename: 'mongolian',
      nameSelector: (loc) => loc.languageMongolian,
    ),
    'bs': _LanguageInfo(
      flagAssetFilename: 'bosnian',
      nameSelector: (loc) => loc.languageBosnian,
    ),
    'kk': _LanguageInfo(
      flagAssetFilename: 'kazakh',
      nameSelector: (loc) => loc.languageKazakh,
    ),
    'sq': _LanguageInfo(
      flagAssetFilename: 'albanian',
      nameSelector: (loc) => loc.languageAlbanian,
    ),
    'sw': _LanguageInfo(
      flagAssetFilename: 'swahili',
      nameSelector: (loc) => loc.languageSwahili,
    ),
    'gl': _LanguageInfo(
      flagAssetFilename: 'spanish',
      nameSelector: (loc) => loc.languageGalician,
    ), // Galician uses Spanish flag
    'mr': _LanguageInfo(
      flagAssetFilename: 'hindi',
      nameSelector: (loc) => loc.languageMarathi,
    ), // Marathi uses Hindi flag
    'pa': _LanguageInfo(
      flagAssetFilename: 'hindi',
      nameSelector: (loc) => loc.languagePunjabi,
    ), // Punjabi uses Hindi flag
    'si': _LanguageInfo(
      flagAssetFilename: 'sinhala',
      nameSelector: (loc) => loc.languageSinhala,
    ),
    'km': _LanguageInfo(
      flagAssetFilename: 'khmer',
      nameSelector: (loc) => loc.languageKhmer,
    ),
    'sn': _LanguageInfo(
      flagAssetFilename: 'shona',
      nameSelector: (loc) => loc.languageShona,
    ),
    'yo': _LanguageInfo(
      flagAssetFilename: 'yoruba',
      nameSelector: (loc) => loc.languageYoruba,
    ),
    'so': _LanguageInfo(
      flagAssetFilename: 'somali',
      nameSelector: (loc) => loc.languageSomali,
    ),
    'af': _LanguageInfo(
      flagAssetFilename: 'afrikaans',
      nameSelector: (loc) => loc.languageAfrikaans,
    ),
    'oc': _LanguageInfo(
      flagAssetFilename: 'french',
      nameSelector: (loc) => loc.languageOccitan,
    ), // Occitan uses French flag
    'ka': _LanguageInfo(
      flagAssetFilename: 'georgian',
      nameSelector: (loc) => loc.languageGeorgian,
    ),
    'be': _LanguageInfo(
      flagAssetFilename: 'belarusian',
      nameSelector: (loc) => loc.languageBelarusian,
    ),
    'tg': _LanguageInfo(
      flagAssetFilename: 'tajik',
      nameSelector: (loc) => loc.languageTajik,
    ),
    'sd': _LanguageInfo(
      flagAssetFilename: 'urdu',
      nameSelector: (loc) => loc.languageSindhi,
    ), // Sindhi uses Urdu flag
    'gu': _LanguageInfo(
      flagAssetFilename: 'hindi',
      nameSelector: (loc) => loc.languageGujarati,
    ), // Gujarati uses Hindi flag
    'am': _LanguageInfo(
      flagAssetFilename: 'amharic',
      nameSelector: (loc) => loc.languageAmharic,
    ),
    'yi': _LanguageInfo(
      flagAssetFilename: 'hebrew',
      nameSelector: (loc) => loc.languageYiddish,
    ), // Yiddish uses Hebrew flag
    'lo': _LanguageInfo(
      flagAssetFilename: 'lao',
      nameSelector: (loc) => loc.languageLao,
    ),
    'uz': _LanguageInfo(
      flagAssetFilename: 'uzbek',
      nameSelector: (loc) => loc.languageUzbek,
    ),
    'fo': _LanguageInfo(
      flagAssetFilename: 'danish',
      nameSelector: (loc) => loc.languageFaroese,
    ), // Faroese uses Danish flag
    'ht': _LanguageInfo(
      flagAssetFilename: 'haitianCreole',
      nameSelector: (loc) => loc.languageHaitianCreole,
    ),
    'ps': _LanguageInfo(
      flagAssetFilename: 'pashto',
      nameSelector: (loc) => loc.languagePashto,
    ),
    'tk': _LanguageInfo(
      flagAssetFilename: 'turkmen',
      nameSelector: (loc) => loc.languageTurkmen,
    ),
    'nn': _LanguageInfo(
      flagAssetFilename: 'norwegian',
      nameSelector: (loc) => loc.languageNynorsk,
    ), // Nynorsk uses Norwegian flag
    'mt': _LanguageInfo(
      flagAssetFilename: 'maltese',
      nameSelector: (loc) => loc.languageMaltese,
    ),
    'sa': _LanguageInfo(
      flagAssetFilename: 'hindi',
      nameSelector: (loc) => loc.languageSanskrit,
    ), // Sanskrit uses Hindi flag
    'lb': _LanguageInfo(
      flagAssetFilename: 'luxembourgish',
      nameSelector: (loc) => loc.languageLuxembourgish,
    ),
    'my': _LanguageInfo(
      flagAssetFilename: 'myanmar',
      nameSelector: (loc) => loc.languageMyanmar,
    ),
    'bo': _LanguageInfo(
      flagAssetFilename: 'tibetan',
      nameSelector: (loc) => loc.languageTibetan,
    ),
    'tl': _LanguageInfo(
      flagAssetFilename: 'tagalog',
      nameSelector: (loc) => loc.languageTagalog,
    ),
    'mg': _LanguageInfo(
      flagAssetFilename: 'malagasy',
      nameSelector: (loc) => loc.languageMalagasy,
    ),
    'as': _LanguageInfo(
      flagAssetFilename: 'hindi',
      nameSelector: (loc) => loc.languageAssamese,
    ), // Assamese uses Hindi flag
    'tt': _LanguageInfo(
      flagAssetFilename: 'tatar',
      nameSelector: (loc) => loc.languageTatar,
    ),
    'haw': _LanguageInfo(
      flagAssetFilename: 'hawaiian',
      nameSelector: (loc) => loc.languageHawaiian,
    ),
    'ln': _LanguageInfo(
      flagAssetFilename: 'lingala',
      nameSelector: (loc) => loc.languageLingala,
    ),
    'ha': _LanguageInfo(
      flagAssetFilename: 'yoruba',
      nameSelector: (loc) => loc.languageHausa,
    ), // Hausa uses Yoruba flag
    'ba': _LanguageInfo(
      flagAssetFilename: 'russian',
      nameSelector: (loc) => loc.languageBashkir,
    ), // Bashkir uses Russian flag
    'jw': _LanguageInfo(
      flagAssetFilename: 'indonesian',
      nameSelector: (loc) => loc.languageJavanese,
    ), // Javanese uses Indonesian flag
    'su': _LanguageInfo(
      flagAssetFilename: 'indonesian',
      nameSelector: (loc) => loc.languageSundanese,
    ), // Sundanese uses Indonesian flag
  };

  static List<SpokenLanguage> get all =>
      _languageData.keys.map((code) => SpokenLanguage(code: code)).toList();

  static SpokenLanguage get defaultLanguage => SpokenLanguage(code: 'en');

  static SpokenLanguage? findByCode(String code) {
    return _languageData.containsKey(code) ? SpokenLanguage(code: code) : null;
  }

  static String flagAssetFor(String code) {
    final info = _languageData[code];
    final filename = info?.flagAssetFilename ?? 'english';
    return 'assets/icons/flags/$filename.svg';
  }

  static String localizedNameFor(String code, AppLocalizations loc) {
    final info = _languageData[code];
    return info?.nameSelector(loc) ?? code;
  }
}
