import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/local_transcription_provider.dart';
import 'transcription_item.dart';
import '../models/transcription.dart';
import '../models/model_type.dart';

class TranscriptionList extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final provider = Provider.of<LocalTranscriptionProvider>(context);
    List<Transcription> items = List.from(provider.sessionTranscriptions);

    Transcription? activePreviewItem;
    bool isVoskStreamingLive = false;
    bool isVoskLoadingResult = false;
    bool isWhisperLoadingResult = false;

    if (provider.selectedModelType == ModelType.vosk) {
      if (provider.isRecording && provider.liveVoskTranscriptionPreview != null) {
        activePreviewItem = provider.liveVoskTranscriptionPreview;
        isVoskStreamingLive = true;
      } else if (provider.isTranscribing && provider.liveVoskTranscriptionPreview != null) {
        activePreviewItem = provider.liveVoskTranscriptionPreview;
        isVoskLoadingResult = true;
      }
    } else if (provider.selectedModelType == ModelType.whisper) {
      if ((provider.isRecording || provider.isTranscribing) && 
          provider.loadingWhisperTranscriptionPreview != null) {
        if (provider.isTranscribing) {
            activePreviewItem = provider.loadingWhisperTranscriptionPreview;
            isWhisperLoadingResult = true;
        }
      }
    }

    if (activePreviewItem != null) {
      items.removeWhere((item) => item.id == activePreviewItem!.id);
      items.add(activePreviewItem);
    }

    if (items.isEmpty) return const SizedBox.shrink();

    return ListView.builder(
      controller: controller,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final transcription = items[index];
        
        bool itemIsVoskStreaming = isVoskStreamingLive && activePreviewItem != null && transcription.id == activePreviewItem.id;
        bool itemIsVoskLoading = isVoskLoadingResult && activePreviewItem != null && transcription.id == activePreviewItem.id;
        bool itemIsWhisperLoading = isWhisperLoadingResult && activePreviewItem != null && transcription.id == activePreviewItem.id;

        return TranscriptionItem(
          transcription: transcription,
          selectionMode: (itemIsVoskStreaming || itemIsVoskLoading || itemIsWhisperLoading) ? false : selectionMode,
          isSelected: (itemIsVoskStreaming || itemIsVoskLoading || itemIsWhisperLoading) ? false : selectedTranscriptionIds.contains(transcription.id),
          isLivePreviewItem: itemIsVoskStreaming,
          isLoadingVoskResult: itemIsVoskLoading,
          isLoadingWhisperResult: itemIsWhisperLoading,
          onTap: () {
            if (!itemIsVoskStreaming && !itemIsVoskLoading && !itemIsWhisperLoading) {
              onTranscriptionTap(transcription.id);
            }
          },
          onLongPress: () {
            if (!itemIsVoskStreaming && !itemIsVoskLoading && !itemIsWhisperLoading) {
              onTranscriptionLongPress(transcription.id);
            }
          },
        );
      },
    );
  }
}
