import 'package:echos/utils/utils.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ui_components/ui_components.dart';
import '../models/model_type.dart';
import '../providers/theme_provider.dart';
import '../models/app_theme.dart';

/// Shows the status of the selected transcription model and an optional retry button.
class ModelStatusTile extends ConsumerWidget {
  final ModelType selectedModelType;
  final bool isModelReady;
  final String? error;
  final VoidCallback onRetry;

  const ModelStatusTile({
    super.key,
    required this.selectedModelType,
    required this.isModelReady,
    this.error,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = selectedTheme.colors(context);
    final modelName = selectedModelType == ModelType.vosk
        ? context.loc.voskModelTitle
        : context.loc.whisperModelTitle;

    if (isModelReady) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: colors.surfacePrimary,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: colors.accentSuccess),
        ),
        child: Row(
          children: [
            AquaIcon.checkCircle(color: colors.accentSuccess),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                '$modelName ${context.loc.modelReadySuffix}',
                style: AquaTypography.body1.copyWith(color: colors.textPrimary),
              ),
            ),
          ],
        ),
      );
    } else if (error != null) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: colors.surfacePrimary,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: colors.accentDanger),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AquaIcon.warning(color: colors.textInverse),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$modelName ${context.loc.modelFailedInitSuffix}',
                    style: AquaTypography.body1.copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    error!,
                    style: AquaTypography.body1.copyWith(
                      color: colors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: onRetry,
                    child: Text(context.loc.retryInitializationButton),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    } else {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: colors.surfacePrimary,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: colors.accentBrand),
        ),
        child: Row(
          children: [
            const SizedBox(
              width: 18,
              height: 18,
              child: AquaIndefinateProgressIndicator(),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                '${context.loc.initializingModelPrefix} $modelName ${context.loc.modelSuffix}',
                style: AquaTypography.body1.copyWith(color: colors.textPrimary),
              ),
            ),
          ],
        ),
      );
    }
  }
}
