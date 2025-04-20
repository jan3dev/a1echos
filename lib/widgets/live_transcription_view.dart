import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/local_transcription_provider.dart';
import 'transcription_list.dart';
import '../constants/app_constants.dart';

/// Shows the live streaming transcription UI and the transcript list below.
class LiveTranscriptionView extends StatelessWidget {
  final ScrollController controller;

  const LiveTranscriptionView({super.key, required this.controller});

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<LocalTranscriptionProvider>(context);

    return Column(
      children: [
        Container(
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            border: Border.all(
              color: Theme.of(context).colorScheme.primary,
              width: 2,
            ),
            borderRadius: BorderRadius.circular(16),
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                AppStrings.liveTranscriptionTitle,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                provider.currentStreamingText.isEmpty
                    ? AppStrings.speakNow
                    : provider.currentStreamingText,
                style: Theme.of(context).textTheme.bodyLarge,
              ),
            ],
          ),
        ),
        Expanded(child: TranscriptionList(controller: controller)),
      ],
    );
  }
}
