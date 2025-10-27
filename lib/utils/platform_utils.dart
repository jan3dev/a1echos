import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';

/// Utility class for platform detection and version checks
class PlatformUtils {
  static final DeviceInfoPlugin _deviceInfo = DeviceInfoPlugin();
  static int? _androidSdkVersion;

  /// Checks if custom tooltip should be shown for clipboard operations
  /// Returns true for iOS and Android < 12, false for Android >= 12
  static Future<bool> shouldShowClipboardTooltip() async {
    if (Platform.isIOS) {
      return true;
    }

    if (Platform.isAndroid) {
      final sdkVersion = await _getAndroidSdkVersion();
      // Android 12 is SDK version 31
      return sdkVersion < 31;
    }

    // Default to showing tooltip for other platforms
    return true;
  }

  /// Gets the Android SDK version (cached after first call)
  static Future<int> _getAndroidSdkVersion() async {
    if (_androidSdkVersion != null) {
      return _androidSdkVersion!;
    }

    try {
      final androidInfo = await _deviceInfo.androidInfo;
      _androidSdkVersion = androidInfo.version.sdkInt;
      return _androidSdkVersion!;
    } catch (e) {
      // If we can't determine the version, assume we should show tooltip
      return 0;
    }
  }
}
