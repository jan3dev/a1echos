import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';
import '../constants/app_constants.dart';

class EmptyTranscriptionsState extends StatelessWidget {
  final String message;

  const EmptyTranscriptionsState({
    super.key,
    this.message = AppStrings.emptySessionsMessage,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AquaColors.lightColors;
    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Padding(
          padding: const EdgeInsets.only(
            bottom: 140.0,
            left: 16.0,
            right: 16.0,
          ),
          child: Text(
            message,
            maxLines: 5,
            textAlign: TextAlign.center,
            style: AquaTypography.subtitleMedium.copyWith(
              color: colors.textPrimary,
            ),
          ),
        ),
      ],
    );
  }
}
