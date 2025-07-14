import 'package:flutter/material.dart';
import 'dart:math';
import 'package:ui_components/ui_components.dart';
import '../providers/transcription_state_manager.dart';
import '../models/model_type.dart';

class AudioWaveVisualization extends StatefulWidget {
  final TranscriptionState state;
  final ModelType modelType;
  final double audioLevel;

  const AudioWaveVisualization({
    super.key,
    required this.state,
    required this.modelType,
    required this.audioLevel,
  });

  @override
  State<AudioWaveVisualization> createState() => _AudioWaveVisualizationState();
}

class _AudioWaveVisualizationState extends State<AudioWaveVisualization>
    with TickerProviderStateMixin {
  final int barsPerSide = 11;
  final random = Random();
  final double maxBarHeight = 56.0;

  Widget _buildAudioWaveSide(int startIndex) {
    return SizedBox(
      height: maxBarHeight,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: List.generate(barsPerSide, (index) {
          if (widget.state == TranscriptionState.recording) {
            // Vary each bar slightly for a more natural look
            final barVariance = 0.85 + (random.nextDouble() * 0.3); // 0.85–1.15
            final barHeight =
                (widget.audioLevel * barVariance).clamp(0.0, 1.0) *
                maxBarHeight;
            return _AudioBar(height: barHeight);
          } else {
            return _AudioBar(height: maxBarHeight * 0.5);
          }
        }),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        // Left side audio wave
        Expanded(child: _buildAudioWaveSide(0)),

        // Space for the recording button (matches button width)
        const SizedBox(width: 96),

        // Right side audio wave
        Expanded(child: _buildAudioWaveSide(barsPerSide)),
      ],
    );
  }
}

class _AudioBar extends StatelessWidget {
  final double height;

  const _AudioBar({required this.height});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 8,
      height: height,
      decoration: BoxDecoration(
        color: AquaColors.lightColors.accentBrand.withOpacity(0.5),
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }
}
