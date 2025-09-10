import 'package:flutter/material.dart';
import 'package:ui_components/config/colors.dart';

abstract class AquaColors {
  // Base Colors
  Color get textPrimary;
  Color get textSecondary;
  Color get textTertiary;
  Color get textInverse;
  Color get surfacePrimary;
  Color get surfaceBorderPrimary;
  Color get surfaceSecondary;
  Color get surfaceBorderSecondary;
  Color get surfaceTertiary;
  Color get surfaceInverse;
  Color get surfaceBackground;
  Color get surfaceSelected;
  Color get surfaceBorderSelected;
  Color get glassSurface;
  Color get glassInverse;
  Color get glassBackground;
  Color get accentBrand;
  Color get accentBrandTransparent;
  Color get accentSuccess;
  Color get accentSuccessTransparent;
  Color get accentWarning;
  Color get accentWarningTransparent;
  Color get accentDanger;
  Color get accentDangerTransparent;

  // Custom Colors
  Color get chipSuccessBackgroundColor;
  Color get chipErrorBackgroundColor;
  Color get chipSuccessForegroundColor;
  Color get chipErrorForegroundColor;

  static AquaColors lightColors = LightColors();
  static AquaColors darkColors = DarkColors();

  static LinearGradient gradient = LinearGradient(
    begin: const Alignment(1, 0),
    end: const Alignment(0, 1),
    colors: [lightColors.accentBrand, AquaPrimitiveColors.neonBlue400],
  );
}

class LightColors implements AquaColors {
  @override
  Color get textPrimary => AquaPrimitiveColors.gray1000;
  @override
  Color get textSecondary => AquaPrimitiveColors.gray750;
  @override
  Color get textTertiary => AquaPrimitiveColors.gray500;
  @override
  Color get textInverse => AquaPrimitiveColors.white;

  @override
  Color get surfacePrimary => AquaPrimitiveColors.white;
  @override
  Color get surfaceBorderPrimary => AquaPrimitiveColors.gray50;
  @override
  Color get surfaceSecondary => AquaPrimitiveColors.gray50;
  @override
  Color get surfaceBorderSecondary => AquaPrimitiveColors.gray100;
  @override
  Color get surfaceTertiary => AquaPrimitiveColors.gray100;
  @override
  Color get surfaceInverse => AquaPrimitiveColors.gray50;
  @override
  Color get surfaceBackground => AquaPrimitiveColors.gray50;
  @override
  Color get surfaceSelected => AquaPrimitiveColors.neonBlue8;
  @override
  Color get surfaceBorderSelected => AquaPrimitiveColors.neonBlue400;

  @override
  Color get glassSurface => const Color(0x80FFFFFF);
  @override
  Color get glassInverse => const Color(0xD9000000);
  @override
  Color get glassBackground => const Color(0x4DF4F5F6);

  @override
  Color get accentBrand => AquaPrimitiveColors.neonBlue500;
  @override
  Color get accentBrandTransparent => AquaPrimitiveColors.neonBlue16;
  @override
  Color get accentSuccess => AquaPrimitiveColors.green500;
  @override
  Color get accentSuccessTransparent => AquaPrimitiveColors.green16;
  @override
  Color get accentWarning => AquaPrimitiveColors.amber500;
  @override
  Color get accentWarningTransparent => AquaPrimitiveColors.amber16;
  @override
  Color get accentDanger => AquaPrimitiveColors.scarlet500;
  @override
  Color get accentDangerTransparent => AquaPrimitiveColors.scarlet16;

  // Custom Colors

  @override
  Color get chipSuccessBackgroundColor => accentSuccessTransparent;
  @override
  Color get chipErrorBackgroundColor => accentDangerTransparent;
  @override
  Color get chipSuccessForegroundColor => accentSuccess;
  @override
  Color get chipErrorForegroundColor => accentDanger;
}

class DarkColors implements AquaColors {
  @override
  Color get textPrimary => AquaPrimitiveColors.gray50;
  @override
  Color get textSecondary => AquaPrimitiveColors.gray500;
  @override
  Color get textTertiary => AquaPrimitiveColors.gray750;
  @override
  Color get textInverse => AquaPrimitiveColors.gray950;

  @override
  Color get surfacePrimary => AquaPrimitiveColors.gray950;
  @override
  Color get surfaceBorderPrimary => AquaPrimitiveColors.gray900;
  @override
  Color get surfaceSecondary => AquaPrimitiveColors.gray900;
  @override
  Color get surfaceBorderSecondary => AquaPrimitiveColors.gray850;
  @override
  Color get surfaceTertiary => AquaPrimitiveColors.gray850;
  @override
  Color get surfaceInverse => AquaPrimitiveColors.gray50;
  @override
  Color get surfaceBackground => AquaPrimitiveColors.gray1000;
  @override
  Color get surfaceSelected => AquaPrimitiveColors.neonBlue8;
  @override
  Color get surfaceBorderSelected => AquaPrimitiveColors.neonBlue800;

  @override
  Color get glassSurface => const Color(0x8027292C);
  @override
  Color get glassInverse => const Color(0xD9FFFFFF);
  @override
  Color get glassBackground => const Color(0x66131516);

  @override
  Color get accentBrand => AquaPrimitiveColors.neonBlue500;
  @override
  Color get accentBrandTransparent => AquaPrimitiveColors.neonBlue16;
  @override
  Color get accentSuccess => AquaPrimitiveColors.green500;
  @override
  Color get accentSuccessTransparent => AquaPrimitiveColors.green16;
  @override
  Color get accentWarning => AquaPrimitiveColors.amber500;
  @override
  Color get accentWarningTransparent => AquaPrimitiveColors.amber16;
  @override
  Color get accentDanger => AquaPrimitiveColors.scarlet500;
  @override
  Color get accentDangerTransparent => AquaPrimitiveColors.scarlet16;

  // Custom Colors

  @override
  Color get chipSuccessBackgroundColor => accentSuccessTransparent;
  @override
  Color get chipErrorBackgroundColor => accentDangerTransparent;
  @override
  Color get chipSuccessForegroundColor => accentSuccess;
  @override
  Color get chipErrorForegroundColor => accentDanger;
}

extension AquaColorsX on AquaColors {
  Color get systemBackgroundColor => const Color(0xFFD0D5DC);
}
