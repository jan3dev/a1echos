import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';
import '../constants/app_constants.dart';

class EmptyTranscriptionsState extends StatelessWidget {
  final String title;
  final String message;

  const EmptyTranscriptionsState({
    super.key,
    this.title = AppStrings.emptySessionsTitle,
    this.message = AppStrings.emptySessionsMessage,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AquaColors.lightColors;

    return Stack(
      children: [
        Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 88,
                  height: 88,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: colors.surfaceTertiary,
                    borderRadius: BorderRadius.circular(100),
                  ),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: colors.surfaceSecondary,
                      borderRadius: BorderRadius.circular(100),
                    ),
                    child: AquaIcon.pending(
                      color: colors.textTertiary,
                      size: 32,
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                AquaText.h4Medium(
                  text: title,
                  size: 24,
                  color: colors.textPrimary,
                  maxLines: 2,
                ),
                const SizedBox(height: 6),
                Text(
                  message,
                  maxLines: 5,
                  textAlign: TextAlign.center,
                  style: AquaTypography.body1.copyWith(
                    height: 1.2,
                    color: colors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
