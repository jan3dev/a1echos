import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';
import '../constants/app_constants.dart';

/// Displays an error message with an optional retry action.
class ErrorView extends StatelessWidget {
  final String errorMessage;
  final VoidCallback? onRetry;

  const ErrorView({super.key, required this.errorMessage, this.onRetry});

  @override
  Widget build(BuildContext context) {
    final colors = AquaColors.lightColors;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AquaIcon.warning(color: colors.textInverse),
            const SizedBox(height: 16),
            Text(
              '${AppStrings.errorPrefix} $errorMessage',
              style: AquaTypography.body1.copyWith(color: colors.textPrimary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            if (onRetry != null)
              AquaButton.primary(text: AppStrings.retry, onPressed: onRetry),
          ],
        ),
      ),
    );
  }
}
