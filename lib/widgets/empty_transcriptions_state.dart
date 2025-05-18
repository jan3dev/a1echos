import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';
import '../constants/app_constants.dart';

class EmptyTranscriptionsState extends StatelessWidget {
  final String title;
  final String message;
  final bool centered;

  const EmptyTranscriptionsState({
    super.key,
    this.title = AppStrings.emptySessionsTitle,
    this.message = AppStrings.emptySessionsMessage,
    this.centered = false,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AquaColors.lightColors;

    final contentColumn = Column(
      mainAxisSize: MainAxisSize.min,
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
            child: AquaIcon.pending(color: colors.textTertiary, size: 32),
          ),
        ),
        const SizedBox(height: 24),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 48.0),
          child: Text(
            title,
            style: AquaTypography.h4Medium.copyWith(color: colors.textPrimary),
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(height: 6),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 48.0),
          child: Text(
            message,
            maxLines: 5,
            textAlign: TextAlign.center,
            style: AquaTypography.body1.copyWith(color: colors.textSecondary),
          ),
        ),
      ],
    );

    if (centered) {
      return Center(child: contentColumn);
    } else {
      return Padding(
        padding: const EdgeInsets.only(top: 88.0),
        child: contentColumn,
      );
    }
  }
}
