import 'package:flutter/material.dart';
import 'transcription_list.dart';

/// Shows the live streaming transcription UI and the transcript list below.
class LiveTranscriptionView extends StatelessWidget {
  final ScrollController controller;

  const LiveTranscriptionView({super.key, required this.controller});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: TranscriptionList(
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
