import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/local_transcription_provider.dart';
import 'transcription_item.dart';

class TranscriptionList extends StatelessWidget {
  final ScrollController controller;

  const TranscriptionList({super.key, required this.controller});

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<LocalTranscriptionProvider>(context);
    final items = provider.sessionTranscriptions;
    if (items.isEmpty) return const SizedBox.shrink();
    return ListView.builder(
      controller: controller,
      padding: const EdgeInsets.only(bottom: 80),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final transcription = items[index];
        return TranscriptionItem(transcription: transcription);
      },
    );
  }
}
