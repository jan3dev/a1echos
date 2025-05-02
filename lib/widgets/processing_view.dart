import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';

/// Widget that shows a loading indicator with a message during transcription processing.
class ProcessingView extends StatelessWidget {
  final String message;

  const ProcessingView({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AquaIndefinateProgressIndicator(
            color: AquaColors.lightColors.textPrimary,
          ),
          const SizedBox(height: 16),
          Text(
            message,
            textAlign: TextAlign.center,
            style: AquaTypography.body1,
          ),
        ],
      ),
    );
  }
}
