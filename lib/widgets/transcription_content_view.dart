import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/local_transcription_provider.dart';
import '../models/model_type.dart';
import '../widgets/transcription_list.dart';
import '../widgets/live_transcription_view.dart';
import '../widgets/error_view.dart';
import '../constants/app_constants.dart';
import 'aqua_tooltip_with_animation.dart';

/// Content view component that manages the main transcription display area
class TranscriptionContentView extends ConsumerWidget {
  final ScrollController scrollController;
  final bool selectionMode;
  final Set<String> selectedTranscriptionIds;
  final Function(String) onTranscriptionTap;
  final Function(String) onTranscriptionLongPress;

  final VoidCallback onEditStart;
  final VoidCallback onEditEnd;

  final GlobalKey<TranscriptionListState>? listKey;

  const TranscriptionContentView({
    super.key,
    required this.scrollController,
    required this.selectionMode,
    required this.selectedTranscriptionIds,
    required this.onTranscriptionTap,
    required this.onTranscriptionLongPress,
    required this.onEditStart,
    required this.onEditEnd,
    this.listKey,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return provider.Consumer<LocalTranscriptionProvider>(
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

        bool isEmpty =
            provider.sessionTranscriptions.isEmpty &&
            !anyPreviewActive &&
            !provider.isRecording;

        bool shouldShowLiveTranscription =
            provider.isRecording ||
            (provider.selectedModelType == ModelType.whisper &&
                provider.whisperRealtime &&
                provider.liveVoskTranscriptionPreview != null);

        return Stack(
          children: [
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              bottom: 128,
              child: Padding(
                padding: const EdgeInsets.only(top: 4),
                child: shouldShowLiveTranscription
                    ? LiveTranscriptionView(controller: scrollController)
                    : TranscriptionList(
                        key: listKey,
                        controller: scrollController,
                        selectionMode: selectionMode,
                        selectedTranscriptionIds: selectedTranscriptionIds,
                        onTranscriptionTap: onTranscriptionTap,
                        onTranscriptionLongPress: onTranscriptionLongPress,
                        onEditModeStarted: onEditStart,
                        onEditModeEnded: onEditEnd,
                      ),
              ),
            ),
            if (isEmpty)
              Positioned(
                bottom: 120,
                left: 0,
                right: 0,
                child: AquaTooltipWithAnimation(
                  message: AppStrings.emptySessionsMessage,
                ),
              ),
          ],
        );
      },
    );
  }
}
