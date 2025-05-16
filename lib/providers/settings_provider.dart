import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SettingsProvider with ChangeNotifier {
  static const String _incognitoModeKey = 'incognito_mode';

  bool _isIncognitoMode = false;
  SharedPreferences? _prefs;

  SettingsProvider() {
    _loadPreferences();
  }

  bool get isIncognitoMode => _isIncognitoMode;

  Future<void> _loadPreferences() async {
    _prefs = await SharedPreferences.getInstance();
    _isIncognitoMode = _prefs?.getBool(_incognitoModeKey) ?? false;
    notifyListeners();
  }

  Future<void> setIncognitoMode(bool value) async {
    _isIncognitoMode = value;
    await _prefs?.setBool(_incognitoModeKey, value);
    notifyListeners();
  }
} 