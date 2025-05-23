import 'package:flutter/material.dart';
import 'dart:math';
import 'package:ui_components/ui_components.dart';
import '../providers/local_transcription_provider.dart';
import '../models/model_type.dart';

class AudioWaveVisualization extends StatefulWidget {
  final TranscriptionState state;
  final ModelType modelType;

  const AudioWaveVisualization({
    super.key,
    required this.state,
    required this.modelType,
  });

  @override
  State<AudioWaveVisualization> createState() => _AudioWaveVisualizationState();
}

class _AudioWaveVisualizationState extends State<AudioWaveVisualization>
    with TickerProviderStateMixin {
  late List<AnimationController> _animationControllers;
  late List<Animation<double>> _animations;
  final int barsPerSide = 11;
  final random = Random();
  final double maxBarHeight = 56.0;

  @override
  void initState() {
    super.initState();
    _initializeAnimations();
  }

  void _initializeAnimations() {
    final totalBars = barsPerSide * 2;
    _animationControllers = List.generate(
      totalBars,
      (index) => AnimationController(
        vsync: this,
        duration: Duration(milliseconds: 600 + random.nextInt(400)),
      ),
    );

    _animations = _animationControllers.map((controller) {
      return Tween<double>(begin: 0.3, end: 1.0).animate(
        CurvedAnimation(parent: controller, curve: Curves.easeInOut),
      );
    }).toList();

    for (var i = 0; i < totalBars; i++) {
      Future.delayed(Duration(milliseconds: random.nextInt(200)), () {
        if (mounted) {
          _animationControllers[i].repeat(reverse: true);
        }
      });
    }
  }

  @override
  void didUpdateWidget(AudioWaveVisualization oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (widget.state == TranscriptionState.recording &&
        oldWidget.state != TranscriptionState.recording) {
      for (var controller in _animationControllers) {
        controller.repeat(reverse: true);
      }
    }

    if (widget.state != TranscriptionState.recording &&
        oldWidget.state == TranscriptionState.recording) {
      for (var controller in _animationControllers) {
        controller.stop();
      }
    }
  }

  @override
  void dispose() {
    for (var controller in _animationControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  Widget _buildAudioWaveSide(int startIndex) {
    return SizedBox(
      height: maxBarHeight,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: List.generate(barsPerSide, (index) {
          final animationIndex = startIndex + index;
          if (widget.state == TranscriptionState.recording) {
            return AnimatedBuilder(
              animation: _animations[animationIndex],
              builder: (context, child) {
                return _AudioBar(height: maxBarHeight * _animations[animationIndex].value);
              },
            );
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
