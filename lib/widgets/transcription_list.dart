import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/local_transcription_provider.dart';
import 'transcription_item.dart';

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
    final items = provider.sessionTranscriptions;

    if (items.isEmpty) return const SizedBox.shrink();

    return ListView.builder(
      controller: controller,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final transcription = items[index];
        return TranscriptionItem(
          transcription: transcription,
          selectionMode: selectionMode,
          isSelected: selectedTranscriptionIds.contains(transcription.id),
          onTap: () => onTranscriptionTap(transcription.id),
          onLongPress: () => onTranscriptionLongPress(transcription.id),
        );
      },
    );
  }
}
