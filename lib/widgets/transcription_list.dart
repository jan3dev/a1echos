import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/local_transcription_provider.dart';
import 'transcription_item.dart';
import '../models/transcription.dart';
import '../models/model_type.dart';

class _ActivePreviewState {
  final Transcription? item;
  final bool isVoskStreamingLive;
  final bool isVoskLoadingResult;
  final bool isWhisperLoading;
  final bool isWhisperRecording;

  const _ActivePreviewState({
    this.item,
    this.isVoskStreamingLive = false,
    this.isVoskLoadingResult = false,
    this.isWhisperLoading = false,
    this.isWhisperRecording = false,
  });

  bool get isPreviewItem =>
      isVoskStreamingLive ||
      isVoskLoadingResult ||
      isWhisperLoading ||
      isWhisperRecording;

  static _ActivePreviewState empty() => const _ActivePreviewState();
}

_ActivePreviewState _determineActivePreviewState(
  LocalTranscriptionProvider provider,
) {
  if (provider.selectedModelType == ModelType.vosk) {
    return _handleVoskPreviewState(provider);
  } else if (provider.selectedModelType == ModelType.whisper) {
    return _handleWhisperPreviewState(provider);
  }
  return _ActivePreviewState.empty();
}

_ActivePreviewState _handleVoskPreviewState(
  LocalTranscriptionProvider provider,
) {
  if (provider.isRecording && provider.liveVoskTranscriptionPreview != null) {
    return _ActivePreviewState(
      item: provider.liveVoskTranscriptionPreview,
      isVoskStreamingLive: true,
    );
  } else if (provider.isTranscribing &&
      provider.liveVoskTranscriptionPreview != null) {
    return _ActivePreviewState(
      item: provider.liveVoskTranscriptionPreview,
      isVoskLoadingResult: true,
    );
  }
  return _ActivePreviewState.empty();
}

_ActivePreviewState _handleWhisperPreviewState(
  LocalTranscriptionProvider provider,
) {
  final bool isRealtime = provider.whisperRealtime;

  if (provider.isRecording) {
    if (isRealtime && provider.liveVoskTranscriptionPreview != null) {
      return _ActivePreviewState(
        item: provider.liveVoskTranscriptionPreview,
        isVoskStreamingLive: true,
      );
    }

    if (!isRealtime && provider.loadingWhisperTranscriptionPreview != null) {
      return _ActivePreviewState(
        item: provider.loadingWhisperTranscriptionPreview,
        isWhisperRecording: true,
      );
    }

    return _ActivePreviewState(
      item: Transcription(
        id: isRealtime
            ? 'whisper_realtime_recording_preview'
            : 'whisper_recording_preview',
        text: '',
        timestamp: DateTime.now(),
        audioPath: '',
      ),
      isWhisperRecording: !isRealtime,
    );
  } else if (provider.isTranscribing &&
      provider.loadingWhisperTranscriptionPreview != null) {
    return _ActivePreviewState(
      item: provider.loadingWhisperTranscriptionPreview,
      isWhisperLoading: true,
    );
  }
  return _ActivePreviewState.empty();
}

class TranscriptionList extends StatefulWidget {
  final ScrollController controller;
  final bool selectionMode;
  final Set<String> selectedTranscriptionIds;
  final Function(String) onTranscriptionTap;
  final Function(String) onTranscriptionLongPress;

  const TranscriptionList({
    super.key,
    required this.controller,
    this.selectionMode = false,
    this.selectedTranscriptionIds = const {},
    required this.onTranscriptionTap,
    required this.onTranscriptionLongPress,
  });

  @override
  State<TranscriptionList> createState() => _TranscriptionListState();
}

class _TranscriptionListState extends State<TranscriptionList> {
  String? editingId;

  void _handleStartEdit(String id) {
    setState(() {
      editingId = id;
    });
  }

  void _handleEndEdit() {
    setState(() {
      editingId = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<LocalTranscriptionProvider>(context);
    List<Transcription> items = List.from(provider.sessionTranscriptions);

    final _ActivePreviewState previewState = _determineActivePreviewState(
      provider,
    );
    final Transcription? activePreviewItem = previewState.item;

    if (activePreviewItem != null) {
      items = [
        ...items.where((item) => item.id != activePreviewItem.id),
        activePreviewItem,
      ];
    }

    if (items.isEmpty) return const SizedBox.shrink();

    return ListView.builder(
      controller: widget.controller,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final transcription = items[index];

        final bool isPreview =
            activePreviewItem != null &&
            transcription.id == activePreviewItem.id;
        final _ActivePreviewState itemState = isPreview
            ? previewState
            : _ActivePreviewState.empty();

        final bool isEditing = editingId == transcription.id;
        final bool isAnyEditing = editingId != null;

        return TranscriptionItem(
          transcription: transcription,
          selectionMode: itemState.isPreviewItem ? false : widget.selectionMode,
          isSelected: itemState.isPreviewItem
              ? false
              : widget.selectedTranscriptionIds.contains(transcription.id),
          isLivePreviewItem: itemState.isVoskStreamingLive,
          isLoadingVoskResult: itemState.isVoskLoadingResult,
          isLoadingWhisperResult: itemState.isWhisperLoading,
          isWhisperRecording: itemState.isWhisperRecording,
          isEditing: isEditing,
          isAnyEditing: isAnyEditing,
          onStartEdit: () => _handleStartEdit(transcription.id),
          onEndEdit: _handleEndEdit,
          onTap: () {
            if (!itemState.isPreviewItem) {
              widget.onTranscriptionTap(transcription.id);
            }
          },
          onLongPress: () {
            if (!itemState.isPreviewItem) {
              widget.onTranscriptionLongPress(transcription.id);
            }
          },
        );
      },
    );
  }
}
