import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';

class ConfirmationModal {
  /// Shows a confirmation modal with warning icon
  /// 
  /// [context] - The build context
  /// [title] - Title text for the modal
  /// [message] - Description/message text 
  /// [confirmText] - Text for the primary/confirm button
  /// [cancelText] - Text for the secondary/cancel button
  /// [onConfirm] - Callback function when user confirms the action
  /// [onCancel] - Optional callback function when user cancels
  /// [isDanger] - Whether to style as a dangerous action (red styling)
  static void show({
    required BuildContext context,
    required String title,
    required String message,
    required String confirmText,
    String cancelText = 'Cancel',
    required VoidCallback onConfirm,
    VoidCallback? onCancel,
    bool isDanger = true,
  }) {
    final colors = AquaColors.lightColors;
    
    AquaModalSheet.show(
      context,
      colors: colors,
      icon: AquaIcon.warning(color: colors.textInverse),
      title: title,
      message: message,
      primaryButtonText: confirmText,
      secondaryButtonText: cancelText,
      onPrimaryButtonTap: onConfirm,
      onSecondaryButtonTap: onCancel ?? () => Navigator.pop(context),
      isDanger: isDanger,
    );
  }
} 