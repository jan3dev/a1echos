import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/local_transcription_provider.dart';
import '../models/model_type.dart';
import '../widgets/transcription_list.dart';
import '../widgets/live_transcription_view.dart';
import '../widgets/error_view.dart';

/// Content view component that manages the main transcription display area
class TranscriptionContentView extends ConsumerWidget {
  static const double _recordingControlsHeight = 167;

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

        bool shouldShowLiveTranscription =
            provider.isRecording ||
            (provider.selectedModelType == ModelType.whisper &&
                provider.whisperRealtime &&
                provider.liveVoskTranscriptionPreview != null);

        return shouldShowLiveTranscription
            ? LiveTranscriptionView(
                controller: scrollController,
                listKey: listKey,
                bottomPadding: _recordingControlsHeight,
              )
            : TranscriptionList(
                key: listKey,
                controller: scrollController,
                selectionMode: selectionMode,
                selectedTranscriptionIds: selectedTranscriptionIds,
                onTranscriptionTap: onTranscriptionTap,
                onTranscriptionLongPress: onTranscriptionLongPress,
                onEditModeStarted: onEditStart,
                onEditModeEnded: onEditEnd,
                bottomPadding: _recordingControlsHeight,
              );
      },
    );
  }
}
