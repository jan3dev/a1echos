import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/local_transcription_provider.dart';
import '../widgets/recording_button.dart';
import '../widgets/audio_wave_visualization.dart';

/// Recording controls component that manages the bottom recording area
class RecordingControlsView extends StatelessWidget {
  const RecordingControlsView({super.key});

  @override
  Widget build(BuildContext context) {
    return Positioned(
      bottom: 32,
      left: 0,
      right: 0,
      child: Center(
        child: Consumer<LocalTranscriptionProvider>(
          builder: (context, transcriptionProvider, _) {
            if (transcriptionProvider.isRecording) {
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    AudioWaveVisualization(
                      state: transcriptionProvider.state,
                      modelType: transcriptionProvider.selectedModelType,
                      audioLevel: transcriptionProvider.audioLevel,
                    ),
                    RecordingButton(useProviderState: true),
                  ],
                ),
              );
            } else {
              return RecordingButton(useProviderState: true);
            }
          },
        ),
      ),
    );
  }
}
