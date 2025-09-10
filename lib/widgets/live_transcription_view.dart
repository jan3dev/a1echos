import 'package:flutter/material.dart';
import 'transcription_list.dart';

/// Shows the live streaming transcription UI and the transcript list below.
class LiveTranscriptionView extends StatelessWidget {
  final ScrollController controller;
  final GlobalKey<TranscriptionListState>? listKey;

  const LiveTranscriptionView({
    super.key,
    required this.controller,
    this.listKey,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: TranscriptionList(
            key: listKey,
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
