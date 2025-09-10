enum AppTheme {
  light,
  dark;

  static AppTheme byName(String name) {
    return switch (name) {
      'Light' => AppTheme.light,
      'Dark' => AppTheme.dark,
      _ => AppTheme.light,
    };
  }
}

extension AppThemeX on AppTheme {
  String get name => switch (this) {
        AppTheme.light => 'Light',
        AppTheme.dark => 'Dark',
      };
}
