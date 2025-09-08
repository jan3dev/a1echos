import 'package:echos/utils/utils.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ui_components/ui_components.dart';
import '../providers/theme_provider.dart';
import '../models/app_theme.dart';

/// Displays an error message with an optional retry action.
class ErrorView extends ConsumerWidget {
  final String errorMessage;
  final VoidCallback? onRetry;

  const ErrorView({super.key, required this.errorMessage, this.onRetry});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = selectedTheme.colors(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AquaIcon.warning(color: colors.textInverse),
            const SizedBox(height: 16),
            Text(
              '${context.loc.errorPrefix} $errorMessage',
              style: AquaTypography.body1.copyWith(color: colors.textPrimary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            if (onRetry != null)
              AquaButton.primary(text: context.loc.retry, onPressed: onRetry),
          ],
        ),
      ),
    );
  }
}
