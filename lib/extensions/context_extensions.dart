import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';
import '../models/app_theme.dart';

extension ContextX on BuildContext {
  ColorScheme get colorScheme => Theme.of(this).colorScheme;
}

extension AppThemeEx on AppTheme {
  AquaColors get colors => switch (this) {
    AppTheme.light => AquaColors.lightColors,
    AppTheme.dark => AquaColors.darkColors,
    AppTheme.auto => AquaColors.lightColors,
  };
}
