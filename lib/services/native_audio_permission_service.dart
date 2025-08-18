import 'dart:io';
import 'package:flutter/services.dart';
import '../logger.dart';

/// Service for handling native audio permissions on iOS using AVAudioSession
/// This uses the same permission system as FlutterWhisperKit
class NativeAudioPermissionService {
  static const MethodChannel _channel = MethodChannel(
    'com.jan3.a1lab.a1echos/audio_permission',
  );

  /// Requests microphone permission using iOS native AVAudioSession.requestRecordPermission
  /// This is the same method used by FlutterWhisperKit
  static Future<bool> requestRecordPermission() async {
    if (!Platform.isIOS) {
      return false;
    }

    try {
      final bool granted = await _channel.invokeMethod(
        'requestRecordPermission',
      );
      return granted;
    } on PlatformException catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.service,
        message: 'Failed to request iOS record permission',
      );
      return false;
    }
  }

  /// Gets the current microphone permission status using iOS native AVAudioSession
  static Future<String> getRecordPermissionStatus() async {
    if (!Platform.isIOS) {
      return 'unsupported';
    }

    try {
      final String status = await _channel.invokeMethod(
        'getRecordPermissionStatus',
      );
      return status;
    } on PlatformException catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.service,
        message: 'Failed to get iOS record permission status',
      );
      return 'error';
    }
  }

  /// Requests permission if not already granted
  static Future<bool> ensureRecordPermission() async {
    final status = await getRecordPermissionStatus();

    if (status == 'granted') {
      return true;
    }

    if (status == 'denied') {
      return false;
    }

    if (status == 'undetermined') {
      return await requestRecordPermission();
    }

    return false;
  }
}
