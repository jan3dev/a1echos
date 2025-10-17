import 'dart:io';
import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:echos/utils/utils.dart';
import '../services/native_audio_permission_service.dart';

class PermissionDialogs {
  static Future<void> showMicrophonePermissionDenied(
    BuildContext context,
    AquaColors colors, {
    VoidCallback? onRetry,
  }) async {
    if (Platform.isIOS) {
      await _showIOSPermissionDenied(context, colors);
    } else {
      await _showAndroidPermissionDenied(context, colors, onRetry: onRetry);
    }
  }

  static Future<void> _showIOSPermissionDenied(
    BuildContext context,
    AquaColors colors,
  ) async {
    AquaModalSheet.show(
      context,
      colors: colors,
      icon: AquaIcon.mic(color: Colors.white),
      iconVariant: AquaModalSheetVariant.warning,
      title: context.loc.microphoneAccessRequiredTitle,
      message: context.loc.microphoneAccessRequiredMessageIOS,
      primaryButtonText: context.loc.openSettings,
      primaryButtonVariant: AquaButtonVariant.warning,
      secondaryButtonText: context.loc.cancel,
      onPrimaryButtonTap: () {
        Navigator.of(context).pop();
        NativeAudioPermissionService.openAppSettings();
      },
      onSecondaryButtonTap: () {
        Navigator.of(context).pop();
      },
    );
  }

  static Future<void> _showAndroidPermissionDenied(
    BuildContext context,
    AquaColors colors, {
    VoidCallback? onRetry,
  }) async {
    AquaModalSheet.show(
      context,
      colors: colors,
      icon: AquaIcon.mic(color: Colors.white),
      iconVariant: AquaModalSheetVariant.warning,
      title: context.loc.microphoneAccessRequiredTitle,
      message: context.loc.microphoneAccessRequiredMessageAndroid,
      primaryButtonText: context.loc.grantPermission,
      primaryButtonVariant: AquaButtonVariant.warning,
      secondaryButtonText: context.loc.cancel,
      onPrimaryButtonTap: () {
        Navigator.of(context).pop();
        onRetry?.call();
      },
      onSecondaryButtonTap: () {
        Navigator.of(context).pop();
      },
    );
  }

  static Future<void> showMicrophonePermanentlyDenied(
    BuildContext context,
    AquaColors colors,
  ) async {
    AquaModalSheet.show(
      context,
      colors: colors,
      icon: AquaIcon.danger(color: Colors.white),
      iconVariant: AquaModalSheetVariant.danger,
      title: context.loc.microphoneAccessDeniedTitle,
      message: context.loc.microphoneAccessDeniedMessage,
      primaryButtonText: context.loc.openSettings,
      primaryButtonVariant: AquaButtonVariant.error,
      secondaryButtonText: context.loc.cancel,
      onPrimaryButtonTap: () {
        Navigator.of(context).pop();
        openAppSettings();
      },
      onSecondaryButtonTap: () {
        Navigator.of(context).pop();
      },
    );
  }
}

