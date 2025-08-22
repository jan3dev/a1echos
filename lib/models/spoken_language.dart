import 'package:flutter/material.dart';
import '../l10n/app_localizations.dart';

class SpokenLanguage {
  final String code;
  final String nameKey;
  final String flag;

  const SpokenLanguage({
    required this.code,
    required this.nameKey,
    required this.flag,
  });

  /// Get the localized name for this language
  String getName(BuildContext context) {
    final loc = AppLocalizations.of(context)!;
    switch (nameKey) {
      case 'languageEnglish':
        return loc.languageEnglish;
      case 'languageChinese':
        return loc.languageChinese;
      case 'languageGerman':
        return loc.languageGerman;
      case 'languageSpanish':
        return loc.languageSpanish;
      case 'languageRussian':
        return loc.languageRussian;
      case 'languageKorean':
        return loc.languageKorean;
      case 'languageFrench':
        return loc.languageFrench;
      case 'languageJapanese':
        return loc.languageJapanese;
      case 'languagePortuguese':
        return loc.languagePortuguese;
      case 'languageTurkish':
        return loc.languageTurkish;
      case 'languagePolish':
        return loc.languagePolish;
      case 'languageCatalan':
        return loc.languageCatalan;
      case 'languageDutch':
        return loc.languageDutch;
      case 'languageArabic':
        return loc.languageArabic;
      case 'languageSwedish':
        return loc.languageSwedish;
      case 'languageItalian':
        return loc.languageItalian;
      case 'languageIndonesian':
        return loc.languageIndonesian;
      case 'languageHindi':
        return loc.languageHindi;
      case 'languageFinnish':
        return loc.languageFinnish;
      case 'languageVietnamese':
        return loc.languageVietnamese;
      case 'languageHebrew':
        return loc.languageHebrew;
      case 'languageUkrainian':
        return loc.languageUkrainian;
      case 'languageGreek':
        return loc.languageGreek;
      case 'languageMalay':
        return loc.languageMalay;
      case 'languageCzech':
        return loc.languageCzech;
      case 'languageRomanian':
        return loc.languageRomanian;
      case 'languageDanish':
        return loc.languageDanish;
      case 'languageHungarian':
        return loc.languageHungarian;
      case 'languageTamil':
        return loc.languageTamil;
      case 'languageNorwegian':
        return loc.languageNorwegian;
      case 'languageThai':
        return loc.languageThai;
      case 'languageUrdu':
        return loc.languageUrdu;
      case 'languageCroatian':
        return loc.languageCroatian;
      case 'languageBulgarian':
        return loc.languageBulgarian;
      case 'languageLithuanian':
        return loc.languageLithuanian;
      case 'languageLatin':
        return loc.languageLatin;
      case 'languageMaori':
        return loc.languageMaori;
      case 'languageMalayalam':
        return loc.languageMalayalam;
      case 'languageWelsh':
        return loc.languageWelsh;
      case 'languageSlovak':
        return loc.languageSlovak;
      case 'languageTelugu':
        return loc.languageTelugu;
      case 'languagePersian':
        return loc.languagePersian;
      case 'languageLatvian':
        return loc.languageLatvian;
      case 'languageBengali':
        return loc.languageBengali;
      case 'languageSerbian':
        return loc.languageSerbian;
      case 'languageAzerbaijani':
        return loc.languageAzerbaijani;
      case 'languageSlovenian':
        return loc.languageSlovenian;
      case 'languageKannada':
        return loc.languageKannada;
      case 'languageEstonian':
        return loc.languageEstonian;
      case 'languageMacedonian':
        return loc.languageMacedonian;
      case 'languageBreton':
        return loc.languageBreton;
      case 'languageBasque':
        return loc.languageBasque;
      case 'languageIcelandic':
        return loc.languageIcelandic;
      case 'languageArmenian':
        return loc.languageArmenian;
      case 'languageNepali':
        return loc.languageNepali;
      case 'languageMongolian':
        return loc.languageMongolian;
      case 'languageBosnian':
        return loc.languageBosnian;
      case 'languageKazakh':
        return loc.languageKazakh;
      case 'languageAlbanian':
        return loc.languageAlbanian;
      case 'languageSwahili':
        return loc.languageSwahili;
      case 'languageGalician':
        return loc.languageGalician;
      case 'languageMarathi':
        return loc.languageMarathi;
      case 'languagePunjabi':
        return loc.languagePunjabi;
      case 'languageSinhala':
        return loc.languageSinhala;
      case 'languageKhmer':
        return loc.languageKhmer;
      case 'languageShona':
        return loc.languageShona;
      case 'languageYoruba':
        return loc.languageYoruba;
      case 'languageSomali':
        return loc.languageSomali;
      case 'languageAfrikaans':
        return loc.languageAfrikaans;
      case 'languageOccitan':
        return loc.languageOccitan;
      case 'languageGeorgian':
        return loc.languageGeorgian;
      case 'languageBelarusian':
        return loc.languageBelarusian;
      case 'languageTajik':
        return loc.languageTajik;
      case 'languageSindhi':
        return loc.languageSindhi;
      case 'languageGujarati':
        return loc.languageGujarati;
      case 'languageAmharic':
        return loc.languageAmharic;
      case 'languageYiddish':
        return loc.languageYiddish;
      case 'languageLao':
        return loc.languageLao;
      case 'languageUzbek':
        return loc.languageUzbek;
      case 'languageFaroese':
        return loc.languageFaroese;
      case 'languageHaitianCreole':
        return loc.languageHaitianCreole;
      case 'languagePashto':
        return loc.languagePashto;
      case 'languageTurkmen':
        return loc.languageTurkmen;
      case 'languageNynorsk':
        return loc.languageNynorsk;
      case 'languageMaltese':
        return loc.languageMaltese;
      case 'languageSanskrit':
        return loc.languageSanskrit;
      case 'languageLuxembourgish':
        return loc.languageLuxembourgish;
      case 'languageMyanmar':
        return loc.languageMyanmar;
      case 'languageTibetan':
        return loc.languageTibetan;
      case 'languageTagalog':
        return loc.languageTagalog;
      case 'languageMalagasy':
        return loc.languageMalagasy;
      case 'languageAssamese':
        return loc.languageAssamese;
      case 'languageTatar':
        return loc.languageTatar;
      case 'languageHawaiian':
        return loc.languageHawaiian;
      case 'languageLingala':
        return loc.languageLingala;
      case 'languageHausa':
        return loc.languageHausa;
      case 'languageBashkir':
        return loc.languageBashkir;
      case 'languageJavanese':
        return loc.languageJavanese;
      case 'languageSundanese':
        return loc.languageSundanese;
      default:
        return nameKey; // Fallback to key if not found
    }
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is SpokenLanguage && other.code == code;
  }

  @override
  int get hashCode => code.hashCode;

  @override
  String toString() =>
      'SpokenLanguage(code: $code, nameKey: $nameKey, flag: $flag)';
}

class SupportedLanguages {
  static const List<SpokenLanguage> all = [
    SpokenLanguage(code: 'en', nameKey: 'languageEnglish', flag: '🇺🇸'),
    SpokenLanguage(code: 'zh', nameKey: 'languageChinese', flag: '🇨🇳'),
    SpokenLanguage(code: 'de', nameKey: 'languageGerman', flag: '🇩🇪'),
    SpokenLanguage(code: 'es', nameKey: 'languageSpanish', flag: '🇪🇸'),
    SpokenLanguage(code: 'ru', nameKey: 'languageRussian', flag: '🇷🇺'),
    SpokenLanguage(code: 'ko', nameKey: 'languageKorean', flag: '🇰🇷'),
    SpokenLanguage(code: 'fr', nameKey: 'languageFrench', flag: '🇫🇷'),
    SpokenLanguage(code: 'ja', nameKey: 'languageJapanese', flag: '🇯🇵'),
    SpokenLanguage(code: 'pt', nameKey: 'languagePortuguese', flag: '🇵🇹'),
    SpokenLanguage(code: 'tr', nameKey: 'languageTurkish', flag: '🇹🇷'),
    SpokenLanguage(code: 'pl', nameKey: 'languagePolish', flag: '🇵🇱'),
    SpokenLanguage(code: 'ca', nameKey: 'languageCatalan', flag: '🇪🇸'),
    SpokenLanguage(code: 'nl', nameKey: 'languageDutch', flag: '🇳🇱'),
    SpokenLanguage(code: 'ar', nameKey: 'languageArabic', flag: '🇸🇦'),
    SpokenLanguage(code: 'sv', nameKey: 'languageSwedish', flag: '🇸🇪'),
    SpokenLanguage(code: 'it', nameKey: 'languageItalian', flag: '🇮🇹'),
    SpokenLanguage(code: 'id', nameKey: 'languageIndonesian', flag: '🇮🇩'),
    SpokenLanguage(code: 'hi', nameKey: 'languageHindi', flag: '🇮🇳'),
    SpokenLanguage(code: 'fi', nameKey: 'languageFinnish', flag: '🇫🇮'),
    SpokenLanguage(code: 'vi', nameKey: 'languageVietnamese', flag: '🇻🇳'),
    SpokenLanguage(code: 'he', nameKey: 'languageHebrew', flag: '🇮🇱'),
    SpokenLanguage(code: 'uk', nameKey: 'languageUkrainian', flag: '🇺🇦'),
    SpokenLanguage(code: 'el', nameKey: 'languageGreek', flag: '🇬🇷'),
    SpokenLanguage(code: 'ms', nameKey: 'languageMalay', flag: '🇲🇾'),
    SpokenLanguage(code: 'cs', nameKey: 'languageCzech', flag: '🇨🇿'),
    SpokenLanguage(code: 'ro', nameKey: 'languageRomanian', flag: '🇷🇴'),
    SpokenLanguage(code: 'da', nameKey: 'languageDanish', flag: '🇩🇰'),
    SpokenLanguage(code: 'hu', nameKey: 'languageHungarian', flag: '🇭🇺'),
    SpokenLanguage(code: 'ta', nameKey: 'languageTamil', flag: '🇮🇳'),
    SpokenLanguage(code: 'no', nameKey: 'languageNorwegian', flag: '🇳🇴'),
    SpokenLanguage(code: 'th', nameKey: 'languageThai', flag: '🇹🇭'),
    SpokenLanguage(code: 'ur', nameKey: 'languageUrdu', flag: '🇵🇰'),
    SpokenLanguage(code: 'hr', nameKey: 'languageCroatian', flag: '🇭🇷'),
    SpokenLanguage(code: 'bg', nameKey: 'languageBulgarian', flag: '🇧🇬'),
    SpokenLanguage(code: 'lt', nameKey: 'languageLithuanian', flag: '🇱🇹'),
    SpokenLanguage(code: 'la', nameKey: 'languageLatin', flag: '🇻🇦'),
    SpokenLanguage(code: 'mi', nameKey: 'languageMaori', flag: '🇳🇿'),
    SpokenLanguage(code: 'ml', nameKey: 'languageMalayalam', flag: '🇮🇳'),
    SpokenLanguage(code: 'cy', nameKey: 'languageWelsh', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿'),
    SpokenLanguage(code: 'sk', nameKey: 'languageSlovak', flag: '🇸🇰'),
    SpokenLanguage(code: 'te', nameKey: 'languageTelugu', flag: '🇮🇳'),
    SpokenLanguage(code: 'fa', nameKey: 'languagePersian', flag: '🇮🇷'),
    SpokenLanguage(code: 'lv', nameKey: 'languageLatvian', flag: '🇱🇻'),
    SpokenLanguage(code: 'bn', nameKey: 'languageBengali', flag: '🇧🇩'),
    SpokenLanguage(code: 'sr', nameKey: 'languageSerbian', flag: '🇷🇸'),
    SpokenLanguage(code: 'az', nameKey: 'languageAzerbaijani', flag: '🇦🇿'),
    SpokenLanguage(code: 'sl', nameKey: 'languageSlovenian', flag: '🇸🇮'),
    SpokenLanguage(code: 'kn', nameKey: 'languageKannada', flag: '🇮🇳'),
    SpokenLanguage(code: 'et', nameKey: 'languageEstonian', flag: '🇪🇪'),
    SpokenLanguage(code: 'mk', nameKey: 'languageMacedonian', flag: '🇲🇰'),
    SpokenLanguage(code: 'br', nameKey: 'languageBreton', flag: '🇫🇷'),
    SpokenLanguage(code: 'eu', nameKey: 'languageBasque', flag: '🇪🇸'),
    SpokenLanguage(code: 'is', nameKey: 'languageIcelandic', flag: '🇮🇸'),
    SpokenLanguage(code: 'hy', nameKey: 'languageArmenian', flag: '🇦🇲'),
    SpokenLanguage(code: 'ne', nameKey: 'languageNepali', flag: '🇳🇵'),
    SpokenLanguage(code: 'mn', nameKey: 'languageMongolian', flag: '🇲🇳'),
    SpokenLanguage(code: 'bs', nameKey: 'languageBosnian', flag: '🇧🇦'),
    SpokenLanguage(code: 'kk', nameKey: 'languageKazakh', flag: '🇰🇿'),
    SpokenLanguage(code: 'sq', nameKey: 'languageAlbanian', flag: '🇦🇱'),
    SpokenLanguage(code: 'sw', nameKey: 'languageSwahili', flag: '🇰🇪'),
    SpokenLanguage(code: 'gl', nameKey: 'languageGalician', flag: '🇪🇸'),
    SpokenLanguage(code: 'mr', nameKey: 'languageMarathi', flag: '🇮🇳'),
    SpokenLanguage(code: 'pa', nameKey: 'languagePunjabi', flag: '🇮🇳'),
    SpokenLanguage(code: 'si', nameKey: 'languageSinhala', flag: '🇱🇰'),
    SpokenLanguage(code: 'km', nameKey: 'languageKhmer', flag: '🇰🇭'),
    SpokenLanguage(code: 'sn', nameKey: 'languageShona', flag: '🇿🇼'),
    SpokenLanguage(code: 'yo', nameKey: 'languageYoruba', flag: '🇳🇬'),
    SpokenLanguage(code: 'so', nameKey: 'languageSomali', flag: '🇸🇴'),
    SpokenLanguage(code: 'af', nameKey: 'languageAfrikaans', flag: '🇿🇦'),
    SpokenLanguage(code: 'oc', nameKey: 'languageOccitan', flag: '🇫🇷'),
    SpokenLanguage(code: 'ka', nameKey: 'languageGeorgian', flag: '🇬🇪'),
    SpokenLanguage(code: 'be', nameKey: 'languageBelarusian', flag: '🇧🇾'),
    SpokenLanguage(code: 'tg', nameKey: 'languageTajik', flag: '🇹🇯'),
    SpokenLanguage(code: 'sd', nameKey: 'languageSindhi', flag: '🇵🇰'),
    SpokenLanguage(code: 'gu', nameKey: 'languageGujarati', flag: '🇮🇳'),
    SpokenLanguage(code: 'am', nameKey: 'languageAmharic', flag: '🇪🇹'),
    SpokenLanguage(code: 'yi', nameKey: 'languageYiddish', flag: '🇮🇱'),
    SpokenLanguage(code: 'lo', nameKey: 'languageLao', flag: '🇱🇦'),
    SpokenLanguage(code: 'uz', nameKey: 'languageUzbek', flag: '🇺🇿'),
    SpokenLanguage(code: 'fo', nameKey: 'languageFaroese', flag: '🇫🇴'),
    SpokenLanguage(code: 'ht', nameKey: 'languageHaitianCreole', flag: '🇭🇹'),
    SpokenLanguage(code: 'ps', nameKey: 'languagePashto', flag: '🇦🇫'),
    SpokenLanguage(code: 'tk', nameKey: 'languageTurkmen', flag: '🇹🇲'),
    SpokenLanguage(code: 'nn', nameKey: 'languageNynorsk', flag: '🇳🇴'),
    SpokenLanguage(code: 'mt', nameKey: 'languageMaltese', flag: '🇲🇹'),
    SpokenLanguage(code: 'sa', nameKey: 'languageSanskrit', flag: '🇮🇳'),
    SpokenLanguage(code: 'lb', nameKey: 'languageLuxembourgish', flag: '🇱🇺'),
    SpokenLanguage(code: 'my', nameKey: 'languageMyanmar', flag: '🇲🇲'),
    SpokenLanguage(code: 'bo', nameKey: 'languageTibetan', flag: '🇨🇳'),
    SpokenLanguage(code: 'tl', nameKey: 'languageTagalog', flag: '🇵🇭'),
    SpokenLanguage(code: 'mg', nameKey: 'languageMalagasy', flag: '🇲🇬'),
    SpokenLanguage(code: 'as', nameKey: 'languageAssamese', flag: '🇮🇳'),
    SpokenLanguage(code: 'tt', nameKey: 'languageTatar', flag: '🇷🇺'),
    SpokenLanguage(code: 'haw', nameKey: 'languageHawaiian', flag: '🇺🇸'),
    SpokenLanguage(code: 'ln', nameKey: 'languageLingala', flag: '🇨🇩'),
    SpokenLanguage(code: 'ha', nameKey: 'languageHausa', flag: '🇳🇬'),
    SpokenLanguage(code: 'ba', nameKey: 'languageBashkir', flag: '🇷🇺'),
    SpokenLanguage(code: 'jw', nameKey: 'languageJavanese', flag: '🇮🇩'),
    SpokenLanguage(code: 'su', nameKey: 'languageSundanese', flag: '🇮🇩'),
  ];

  static SpokenLanguage get defaultLanguage => all.first; // English

  static SpokenLanguage? findByCode(String code) {
    try {
      return all.firstWhere((lang) => lang.code == code);
    } catch (e) {
      return null;
    }
  }
}
