import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../logger.dart';

class SettingsProvider with ChangeNotifier {
  static const String _incognitoModeKey = 'incognito_mode';

  bool _isIncognitoMode = false;
  SharedPreferences? _prefs;

  SettingsProvider._();

  static Future<SettingsProvider> create() async {
    final provider = SettingsProvider._();
    await provider._loadPreferences();
    return provider;
  }

  bool get isIncognitoMode => _isIncognitoMode;

  Future<void> _loadPreferences() async {
    try {
      _prefs = await SharedPreferences.getInstance();
      _isIncognitoMode = _prefs?.getBool(_incognitoModeKey) ?? false;
    } catch (e, st) {
      logger.error(e,
          stackTrace: st,
          flag: FeatureFlag.provider,
          message: 'Failed to load incognito preference');
      _isIncognitoMode = false;
    }
    notifyListeners();
  }

  Future<void> setIncognitoMode(bool value) async {
    final oldValue = _isIncognitoMode;
    _isIncognitoMode = value;
    try {
      await _prefs?.setBool(_incognitoModeKey, value);
      notifyListeners();
    } catch (e, st) {
      logger.error(e,
          stackTrace: st,
          flag: FeatureFlag.provider,
          message: 'Failed to save incognito preference');
      _isIncognitoMode = oldValue;
      rethrow;
    }
  }
}
