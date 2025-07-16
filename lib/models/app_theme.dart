import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';

/// Enum for supported app themes.
enum AppTheme {
  auto,
  light,
  dark;

  static AppTheme byName(String name) {
    return switch (name) {
      'Auto' => AppTheme.auto,
      'Light' => AppTheme.light,
      'Dark' => AppTheme.dark,
      _ => AppTheme.light,
    };
  }
}

extension AppThemeX on AppTheme {
  String get name => switch (this) {
    AppTheme.auto => 'Auto',
    AppTheme.light => 'Light',
    AppTheme.dark => 'Dark',
  };

  AquaColors colors(BuildContext context) {
    switch (this) {
      case AppTheme.light:
        return AquaColors.lightColors;
      case AppTheme.dark:
        return AquaColors.darkColors;
      case AppTheme.auto:
        final brightness = MediaQuery.of(context).platformBrightness;
        return brightness == Brightness.dark
            ? AquaColors.darkColors
            : AquaColors.lightColors;
    }
  }
}
