import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ui_components/ui_components.dart';
import '../providers/local_transcription_provider.dart';
import 'transcription_list.dart';
import '../constants/app_constants.dart';
import '../models/model_type.dart';

/// Shows the live streaming transcription UI and the transcript list below.
class LiveTranscriptionView extends StatelessWidget {
  final ScrollController controller;

  const LiveTranscriptionView({super.key, required this.controller});

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<LocalTranscriptionProvider>(context);
    final colors = AquaColors.lightColors;
    final isVoskModel = provider.selectedModelType == ModelType.vosk;

    return Column(
      children: [
        if (isVoskModel)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
            child: Text(
              provider.currentStreamingText.isEmpty
                  ? AppStrings.speakNow
                  : provider.currentStreamingText,
              style: AquaTypography.h5.copyWith(color: colors.textPrimary),
              textAlign: TextAlign.center,
            ),
          ),

        Expanded(
          child: TranscriptionList(
            controller: controller,
            selectionMode: false,
            selectedTranscriptionIds: const {},
            onTranscriptionTap: (_) {},
            onTranscriptionLongPress: (_) {},
          ),
        ),
      ],
    );
  }
}
