import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/local_transcription_provider.dart';
import '../models/model_type.dart';
import '../widgets/transcription_list.dart';
import '../widgets/live_transcription_view.dart';
import '../widgets/empty_transcriptions_state.dart';
import '../widgets/error_view.dart';

/// Content view component that manages the main transcription display area
class TranscriptionContentView extends StatelessWidget {
  final ScrollController scrollController;
  final bool selectionMode;
  final Set<String> selectedTranscriptionIds;
  final Function(String) onTranscriptionTap;
  final Function(String) onTranscriptionLongPress;

  const TranscriptionContentView({
    super.key,
    required this.scrollController,
    required this.selectionMode,
    required this.selectedTranscriptionIds,
    required this.onTranscriptionTap,
    required this.onTranscriptionLongPress,
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<LocalTranscriptionProvider>(
      builder: (context, provider, child) {
        if (provider.isLoading) {
          return const Center(child: CircularProgressIndicator());
        }

        if (provider.error != null) {
          return ErrorView(errorMessage: provider.error!);
        }

        bool whisperPreviewIsActive =
            provider.selectedModelType == ModelType.whisper &&
            provider.isTranscribing &&
            provider.loadingWhisperTranscriptionPreview != null;

        bool voskPreviewIsActive =
            provider.selectedModelType == ModelType.vosk &&
            ((provider.isRecording &&
                    provider.liveVoskTranscriptionPreview != null) ||
                (provider.isTranscribing &&
                    provider.liveVoskTranscriptionPreview != null));

        bool whisperRealtimePreviewIsActive =
            provider.selectedModelType == ModelType.whisper &&
            provider.whisperRealtime &&
            provider.isRecording &&
            provider.liveVoskTranscriptionPreview != null;

        bool anyPreviewActive =
            whisperPreviewIsActive ||
            voskPreviewIsActive ||
            whisperRealtimePreviewIsActive;

        if (provider.sessionTranscriptions.isEmpty &&
            !anyPreviewActive &&
            !provider.isRecording) {
          return const EmptyTranscriptionsState();
        }

        bool shouldShowLiveTranscription =
            provider.isRecording ||
            (provider.selectedModelType == ModelType.whisper &&
                provider.whisperRealtime &&
                provider.liveVoskTranscriptionPreview != null);

        return Positioned(
          top: 0,
          left: 0,
          right: 0,
          bottom: 128,
          child: Padding(
            padding: const EdgeInsets.only(top: 4),
            child: shouldShowLiveTranscription
                ? LiveTranscriptionView(controller: scrollController)
                : TranscriptionList(
                    controller: scrollController,
                    selectionMode: selectionMode,
                    selectedTranscriptionIds: selectedTranscriptionIds,
                    onTranscriptionTap: onTranscriptionTap,
                    onTranscriptionLongPress: onTranscriptionLongPress,
                  ),
          ),
        );
      },
    );
  }
}
