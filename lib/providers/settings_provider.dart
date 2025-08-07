import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../logger.dart';

class SettingsProvider with ChangeNotifier {
  static const String _incognitoModeKey = 'incognito_mode';
  static const String _incognitoExplainerSeenKey = 'incognito_explainer_seen';

  bool _isIncognitoMode = false;
  bool _hasSeenIncognitoExplainer = false;
  SharedPreferences? _prefs;

  SettingsProvider._();

  static Future<SettingsProvider> create() async {
    final provider = SettingsProvider._();
    await provider._loadPreferences();
    return provider;
  }

  bool get isIncognitoMode => _isIncognitoMode;
  bool get hasSeenIncognitoExplainer => _hasSeenIncognitoExplainer;

  Future<void> _loadPreferences() async {
    try {
      _prefs = await SharedPreferences.getInstance();
      _isIncognitoMode = _prefs?.getBool(_incognitoModeKey) ?? false;
      _hasSeenIncognitoExplainer =
          _prefs?.getBool(_incognitoExplainerSeenKey) ?? false;
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.provider,
        message: 'Failed to load incognito preference',
      );
      _isIncognitoMode = false;
      _hasSeenIncognitoExplainer = false;
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
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.provider,
        message: 'Failed to save incognito preference',
      );
      _isIncognitoMode = oldValue;
      rethrow;
    }
  }

  /// Marks the explainer modal as seen and persists the flag.
  Future<void> markIncognitoExplainerSeen() async {
    _hasSeenIncognitoExplainer = true;
    try {
      await _prefs?.setBool(_incognitoExplainerSeenKey, true);
    } catch (_) {
      // ignore persistence errors
    }
    notifyListeners();
  }
}
