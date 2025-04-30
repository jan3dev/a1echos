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
  final int barCount = 31;
  final random = Random();

  @override
  void initState() {
    super.initState();
    _initializeAnimations();
  }

  void _initializeAnimations() {
    _animationControllers = List.generate(
      barCount,
      (index) => AnimationController(
        vsync: this,
        duration: Duration(milliseconds: 600 + random.nextInt(400)),
      ),
    );

    _animations =
        _animationControllers.map((controller) {
          return Tween<double>(begin: 0.3, end: 1.0).animate(
            CurvedAnimation(parent: controller, curve: Curves.easeInOut),
          );
        }).toList();

    for (var i = 0; i < barCount; i++) {
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

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: List.generate(barCount, (index) {
          if (widget.state == TranscriptionState.transcribing) {
            return _AudioBar(height: 20);
          }

          return AnimatedBuilder(
            animation: _animations[index],
            builder: (context, child) {
              return _AudioBar(height: 40 * _animations[index].value);
            },
          );
        }),
      ),
    );
  }
}

class _AudioBar extends StatelessWidget {
  final double height;

  const _AudioBar({required this.height});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 4,
      height: height,
      decoration: BoxDecoration(
        color: AquaColors.lightColors.accentDanger,
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }
}
