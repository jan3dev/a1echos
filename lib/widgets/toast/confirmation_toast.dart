import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/app_theme.dart';
import '../../providers/theme_provider.dart';

class ConfirmationToast {
  /// Shows a toast with warning icon
  ///
  /// [context] - The build context
  /// [title] - Title text for the toast
  /// [message] - Description/message text
  /// [confirmText] - Text for the primary/confirm button
  /// [cancelText] - Text for the secondary/cancel button
  /// [onConfirm] - Callback function when user confirms the action
  /// [onCancel] - Optional callback function when user cancels
  static void show({
    required BuildContext context,
    required WidgetRef ref,
    required String title,
    required String message,
    String? confirmText,
    String? cancelText,
    VoidCallback? onConfirm,
    VoidCallback? onCancel,
  }) {
    final appTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = appTheme.colors(context);

    AquaToast.show(
      context,
      colors: colors,
      title: title,
      message: message,
      primaryButtonText: confirmText,
      secondaryButtonText: cancelText,
      onPrimaryButtonTap: onConfirm,
      onSecondaryButtonTap: onCancel ?? () => Navigator.pop(context),
      iconVariant: AquaToastVariant.informative,
    );
  }
}
