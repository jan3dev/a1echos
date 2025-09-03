import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/local_transcription_provider.dart';
import '../widgets/recording_button.dart';
import '../widgets/audio_wave_visualization.dart';
import '../widgets/static_wave_bars.dart';

/// Recording controls component that manages the bottom recording area
class RecordingControlsView extends ConsumerWidget {
  const RecordingControlsView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Positioned(
      bottom: 16,
      left: 0,
      right: 0,
      child: provider.Consumer<LocalTranscriptionProvider>(
        builder: (context, transcriptionProvider, _) {
          if (transcriptionProvider.isRecording ||
              transcriptionProvider.isTranscribing) {
            return _buildRecordingLayout(transcriptionProvider);
          } else {
            return _buildReadyLayout(transcriptionProvider);
          }
        },
      ),
    );
  }

  Widget _buildRecordingLayout(
    LocalTranscriptionProvider transcriptionProvider,
  ) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: const RecordingButton(useProviderState: true),
        ),
        const SizedBox(height: 16),
        if (transcriptionProvider.isTranscribing)
          SizedBox(
            height: 64,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: const StaticWaveBars(),
            ),
          )
        else if (transcriptionProvider.isRecording)
          SizedBox(
            height: 64,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: AudioWaveVisualization(
                state: transcriptionProvider.state,
                modelType: transcriptionProvider.selectedModelType,
                audioLevel: transcriptionProvider.audioLevel,
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildReadyLayout(LocalTranscriptionProvider transcriptionProvider) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: const RecordingButton(useProviderState: true),
        ),
        const SizedBox(height: 42),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: const StaticWaveBars(),
        ),
        const SizedBox(height: 26),
      ],
    );
  }
}
