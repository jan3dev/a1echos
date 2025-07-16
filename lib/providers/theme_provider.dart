import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:ui_components/ui_components.dart';
import '../models/app_theme.dart';

final _lightTheme = AquaLightTheme();
final _darkTheme = AquaDarkTheme();

final sharedPreferencesProvider = Provider<SharedPreferences>((ref) {
  throw UnimplementedError('SharedPreferencesProvider is not implemented');
});

final prefsProvider = ChangeNotifierProvider<UserPreferencesNotifier>((ref) {
  final prefs = ref.read(sharedPreferencesProvider);
  return UserPreferencesNotifier(prefs);
});

final themeModeProvider = Provider<ThemeMode>((ref) {
  final selectedTheme = ref.watch(prefsProvider).selectedTheme;
  return switch (selectedTheme) {
    AppTheme.light => ThemeMode.light,
    AppTheme.dark => ThemeMode.dark,
    AppTheme.auto => ThemeMode.system,
  };
});

final lightThemeProvider = Provider<ThemeData>((ref) => _lightTheme.themeData);
final darkThemeProvider = Provider<ThemeData>((ref) => _darkTheme.themeData);

class UserPreferencesNotifier extends ChangeNotifier {
  UserPreferencesNotifier(this._prefs);

  static const _selectedThemeKey = 'selectedTheme';

  final SharedPreferences _prefs;

  AppTheme get selectedTheme {
    final theme = _prefs.getString(_selectedThemeKey);
    return theme == null ? AppTheme.auto : AppTheme.byName(theme);
  }

  Future<void> switchTheme(AppTheme theme) async {
    await _prefs.setString(_selectedThemeKey, theme.name);
    notifyListeners();
  }
}
