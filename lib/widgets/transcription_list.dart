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

    bool showLiveVoskItem = provider.isRecording &&
        provider.selectedModelType == ModelType.vosk &&
        provider.liveVoskTranscriptionPreview != null;

    if (showLiveVoskItem) {
      items.add(provider.liveVoskTranscriptionPreview!);
    }

    if (items.isEmpty) return const SizedBox.shrink();

    return ListView.builder(
      controller: controller,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final transcription = items[index];
        bool isTheLiveVoskItem = showLiveVoskItem && (transcription.id == 'live_vosk_active_preview');

        return TranscriptionItem(
          transcription: transcription,
          selectionMode: isTheLiveVoskItem ? false : selectionMode,
          isSelected: isTheLiveVoskItem ? false : selectedTranscriptionIds.contains(transcription.id),
          onTap: () {
            if (!isTheLiveVoskItem) {
              onTranscriptionTap(transcription.id);
            }
          },
          onLongPress: () {
            if (!isTheLiveVoskItem) {
              onTranscriptionLongPress(transcription.id);
            }
          },
        );
      },
    );
  }
}
