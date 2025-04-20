import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/local_transcription_provider.dart';
import '../constants/app_constants.dart';
import 'transcription_list.dart';

/// Displays either an empty prompt or the list of transcriptions for the current session.
class TranscriptionContentView extends StatelessWidget {
  final ScrollController controller;

  const TranscriptionContentView({super.key, required this.controller});

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<LocalTranscriptionProvider>(context);
    final items = provider.sessionTranscriptions;
    if (items.isEmpty && provider.state != TranscriptionState.recording) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Text(
            AppStrings.tapToStart,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 16, color: Colors.grey),
          ),
        ),
      );
    }
    return TranscriptionList(controller: controller);
  }
}
