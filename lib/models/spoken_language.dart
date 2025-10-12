import 'package:flutter/material.dart';
import 'package:ui_components/components/icon/flag_icon.dart';
import '../l10n/app_localizations.dart';

class SpokenLanguage {
  final String code;

  const SpokenLanguage({required this.code});

  /// Get the country code for this language's flag
  String get countryCode => SupportedLanguages.countryCodeFor(code);

  /// Get the FlagIcon widget for this language
  Widget getFlagIcon({double size = 24.0}) {
    return FlagIcon(countryCode, size: size);
  }

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
  final String countryCode;
  final String Function(AppLocalizations) nameSelector;

  const _LanguageInfo({required this.countryCode, required this.nameSelector});
}

class SupportedLanguages {
  static final Map<String, _LanguageInfo> _languageData = {
    'en': _LanguageInfo(
      countryCode: 'united_states',
      nameSelector: (loc) => loc.languageEnglish,
    ),
    'zh': _LanguageInfo(
      countryCode: 'china',
      nameSelector: (loc) => loc.languageChinese,
    ),
    'de': _LanguageInfo(
      countryCode: 'germany',
      nameSelector: (loc) => loc.languageGerman,
    ),
    'es': _LanguageInfo(
      countryCode: 'spain',
      nameSelector: (loc) => loc.languageSpanish,
    ),
    'ru': _LanguageInfo(
      countryCode: 'russia',
      nameSelector: (loc) => loc.languageRussian,
    ),
    'ko': _LanguageInfo(
      countryCode: 'south_korea',
      nameSelector: (loc) => loc.languageKorean,
    ),
    'fr': _LanguageInfo(
      countryCode: 'france',
      nameSelector: (loc) => loc.languageFrench,
    ),
    'ja': _LanguageInfo(
      countryCode: 'japan',
      nameSelector: (loc) => loc.languageJapanese,
    ),
    'pt': _LanguageInfo(
      countryCode: 'portugal',
      nameSelector: (loc) => loc.languagePortuguese,
    ),
    'tr': _LanguageInfo(
      countryCode: 'turkey',
      nameSelector: (loc) => loc.languageTurkish,
    ),
    'pl': _LanguageInfo(
      countryCode: 'poland',
      nameSelector: (loc) => loc.languagePolish,
    ),
    'nl': _LanguageInfo(
      countryCode: 'netherlands',
      nameSelector: (loc) => loc.languageDutch,
    ),
    'ar': _LanguageInfo(
      countryCode: 'saudi_arabia',
      nameSelector: (loc) => loc.languageArabic,
    ), // Arabic uses Saudi Arabia flag
    'sv': _LanguageInfo(
      countryCode: 'sweden',
      nameSelector: (loc) => loc.languageSwedish,
    ),
    'it': _LanguageInfo(
      countryCode: 'italy',
      nameSelector: (loc) => loc.languageItalian,
    ),
    'id': _LanguageInfo(
      countryCode: 'indonesia',
      nameSelector: (loc) => loc.languageIndonesian,
    ),
    'fi': _LanguageInfo(
      countryCode: 'finland',
      nameSelector: (loc) => loc.languageFinnish,
    ),
    'vi': _LanguageInfo(
      countryCode: 'vietnam',
      nameSelector: (loc) => loc.languageVietnamese,
    ),
    'he': _LanguageInfo(
      countryCode: 'israel',
      nameSelector: (loc) => loc.languageHebrew,
    ),
    'uk': _LanguageInfo(
      countryCode: 'ukraine',
      nameSelector: (loc) => loc.languageUkrainian,
    ),
    'el': _LanguageInfo(
      countryCode: 'greece',
      nameSelector: (loc) => loc.languageGreek,
    ),
    'ms': _LanguageInfo(
      countryCode: 'malaysia',
      nameSelector: (loc) => loc.languageMalay,
    ),
    'cs': _LanguageInfo(
      countryCode: 'czech_republic',
      nameSelector: (loc) => loc.languageCzech,
    ),
    'ro': _LanguageInfo(
      countryCode: 'romania',
      nameSelector: (loc) => loc.languageRomanian,
    ),
    'da': _LanguageInfo(
      countryCode: 'denmark',
      nameSelector: (loc) => loc.languageDanish,
    ),
    'hu': _LanguageInfo(
      countryCode: 'hungary',
      nameSelector: (loc) => loc.languageHungarian,
    ),
    'no': _LanguageInfo(
      countryCode: 'norway',
      nameSelector: (loc) => loc.languageNorwegian,
    ),
    'hr': _LanguageInfo(
      countryCode: 'croatia',
      nameSelector: (loc) => loc.languageCroatian,
    ),
    'bg': _LanguageInfo(
      countryCode: 'bulgaria',
      nameSelector: (loc) => loc.languageBulgarian,
    ),
    'lt': _LanguageInfo(
      countryCode: 'lithuania',
      nameSelector: (loc) => loc.languageLithuanian,
    ),
    'la': _LanguageInfo(
      countryCode: 'vatican_city',
      nameSelector: (loc) => loc.languageLatin,
    ), // Latin uses Vatican City flag
    'mi': _LanguageInfo(
      countryCode: 'new_zealand',
      nameSelector: (loc) => loc.languageMaori,
    ), // Maori uses New Zealand flag
    'sk': _LanguageInfo(
      countryCode: 'slovakia',
      nameSelector: (loc) => loc.languageSlovak,
    ),
    'te': _LanguageInfo(
      countryCode: 'india',
      nameSelector: (loc) => loc.languageTelugu,
    ), // Telugu uses India flag
    'fa': _LanguageInfo(
      countryCode: 'iran',
      nameSelector: (loc) => loc.languagePersian,
    ),
    'lv': _LanguageInfo(
      countryCode: 'latvia',
      nameSelector: (loc) => loc.languageLatvian,
    ),
    'bn': _LanguageInfo(
      countryCode: 'bangladesh',
      nameSelector: (loc) => loc.languageBengali,
    ),
    'sr': _LanguageInfo(
      countryCode: 'serbia',
      nameSelector: (loc) => loc.languageSerbian,
    ),
    'sl': _LanguageInfo(
      countryCode: 'slovenia',
      nameSelector: (loc) => loc.languageSlovenian,
    ),
    'kn': _LanguageInfo(
      countryCode: 'india',
      nameSelector: (loc) => loc.languageKannada,
    ), // Kannada uses India flag
    'et': _LanguageInfo(
      countryCode: 'estonia',
      nameSelector: (loc) => loc.languageEstonian,
    ),
    'mk': _LanguageInfo(
      countryCode: 'republic_of_macedonia',
      nameSelector: (loc) => loc.languageMacedonian,
    ),
    'eu': _LanguageInfo(
      countryCode: 'spain',
      nameSelector: (loc) => loc.languageBasque,
    ), // Basque uses Spain flag
    'hy': _LanguageInfo(
      countryCode: 'armenia',
      nameSelector: (loc) => loc.languageArmenian,
    ),
    'mn': _LanguageInfo(
      countryCode: 'mongolia',
      nameSelector: (loc) => loc.languageMongolian,
    ),
    'bs': _LanguageInfo(
      countryCode: 'bosnia_and_herzegovina',
      nameSelector: (loc) => loc.languageBosnian,
    ),
    'kk': _LanguageInfo(
      countryCode: 'kazakhstan',
      nameSelector: (loc) => loc.languageKazakh,
    ),
    'gl': _LanguageInfo(
      countryCode: 'spain',
      nameSelector: (loc) => loc.languageGalician,
    ), // Galician uses Spain flag
    'sn': _LanguageInfo(
      countryCode: 'zimbabwe',
      nameSelector: (loc) => loc.languageShona,
    ),
    'yo': _LanguageInfo(
      countryCode: 'nigeria',
      nameSelector: (loc) => loc.languageYoruba,
    ), // Yoruba uses Nigeria flag
    'so': _LanguageInfo(
      countryCode: 'somalia',
      nameSelector: (loc) => loc.languageSomali,
    ),
    'af': _LanguageInfo(
      countryCode: 'south_africa',
      nameSelector: (loc) => loc.languageAfrikaans,
    ),
    'oc': _LanguageInfo(
      countryCode: 'france',
      nameSelector: (loc) => loc.languageOccitan,
    ), // Occitan uses France flag
    'ka': _LanguageInfo(
      countryCode: 'georgia',
      nameSelector: (loc) => loc.languageGeorgian,
    ),
    'be': _LanguageInfo(
      countryCode: 'belarus',
      nameSelector: (loc) => loc.languageBelarusian,
    ),
    'tg': _LanguageInfo(
      countryCode: 'tajikistan',
      nameSelector: (loc) => loc.languageTajik,
    ),
    'lo': _LanguageInfo(
      countryCode: 'laos',
      nameSelector: (loc) => loc.languageLao,
    ),
    'uz': _LanguageInfo(
      countryCode: 'uzbekistan',
      nameSelector: (loc) => loc.languageUzbek,
    ),
    'mt': _LanguageInfo(
      countryCode: 'malta',
      nameSelector: (loc) => loc.languageMaltese,
    ),
    'sa': _LanguageInfo(
      countryCode: 'india',
      nameSelector: (loc) => loc.languageSanskrit,
    ), // Sanskrit uses India flag
    'mg': _LanguageInfo(
      countryCode: 'madagascar',
      nameSelector: (loc) => loc.languageMalagasy,
    ),
    'as': _LanguageInfo(
      countryCode: 'india',
      nameSelector: (loc) => loc.languageAssamese,
    ), // Assamese uses India flag
    'tt': _LanguageInfo(
      countryCode: 'russia',
      nameSelector: (loc) => loc.languageTatar,
    ), // Tatar uses Russia flag
    'ln': _LanguageInfo(
      countryCode: 'democratic_republic_of_congo',
      nameSelector: (loc) => loc.languageLingala,
    ), // Lingala uses DRC flag
    'ba': _LanguageInfo(
      countryCode: 'russia',
      nameSelector: (loc) => loc.languageBashkir,
    ), // Bashkir uses Russia flag
  };

  static List<SpokenLanguage> get all =>
      _languageData.keys.map((code) => SpokenLanguage(code: code)).toList();

  static SpokenLanguage get defaultLanguage => SpokenLanguage(code: 'en');

  static SpokenLanguage? findByCode(String code) {
    return _languageData.containsKey(code) ? SpokenLanguage(code: code) : null;
  }

  static String countryCodeFor(String code) {
    final info = _languageData[code];
    return info?.countryCode ?? 'united_states';
  }

  static String localizedNameFor(String code, AppLocalizations loc) {
    final info = _languageData[code];
    return info?.nameSelector(loc) ?? code;
  }
}
