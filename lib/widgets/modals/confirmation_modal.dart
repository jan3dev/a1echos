import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/app_theme.dart';
import '../../constants/app_constants.dart';
import '../../providers/theme_provider.dart';

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
  static void show({
    required BuildContext context,
    required WidgetRef ref,
    required String title,
    required String message,
    required String confirmText,
    String cancelText = AppStrings.cancel,
    required VoidCallback onConfirm,
    VoidCallback? onCancel,
  }) {
    final appTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = appTheme.colors(context);

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
      iconVariant: AquaModalSheetVariant.warning,
    );
  }
}
