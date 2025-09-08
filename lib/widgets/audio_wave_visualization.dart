import 'package:flutter/material.dart';
import 'dart:math' as math;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/theme_provider.dart';
import '../providers/transcription_state_manager.dart';
import '../models/model_type.dart';
import '../models/app_theme.dart';

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
  final int totalBars = 60;
  final double maxBarHeight = 64.0;
  final double minBarHeight = 4.0;

  late final AnimationController _animController;
  late final AnimationController _waveController;
  double _displayLevel = 0.0;
  VoidCallback? _animListener;

  final List<double> _waveformData = [];
  final List<double> _targetHeights = [];
  final List<double> _animationSpeeds = [];
  final List<double> _randomFactors = [];
  final List<double> _groupPatterns = [];
  final List<double> _groupEvolution = [];

  double _timeOffset = 0.0;
  double _lastAmplitudeChange = 0.0;
  final double _amplitudeChangeThreshold = 0.05;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 10),
    );

    _waveController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 8),
    )..repeat();

    _initializeWaveformData();

    _waveController.addListener(_updateWaveform);
  }

  void _initializeWaveformData() {
    _waveformData.clear();
    _targetHeights.clear();
    _animationSpeeds.clear();
    _randomFactors.clear();
    _groupPatterns.clear();
    _groupEvolution.clear();

    for (int i = 0; i < totalBars; i++) {
      _waveformData.add(minBarHeight / maxBarHeight);
      _targetHeights.add(minBarHeight / maxBarHeight);
      _animationSpeeds.add(0.3 + (math.Random().nextDouble() * 0.4));
      _randomFactors.add(math.Random().nextDouble());
      _groupPatterns.add(0.0);
      _groupEvolution.add(math.Random().nextDouble() * 0.02);
    }

    _generateGroupedPattern();
  }

  void _updateWaveform() {
    if (!mounted) return;

    _timeOffset += 0.02;

    _evolveGroupPatterns();

    if ((_displayLevel - _lastAmplitudeChange).abs() >
            _amplitudeChangeThreshold ||
        _timeOffset % 2.0 < 0.02) {
      _generateGroupedPattern();
      _lastAmplitudeChange = _displayLevel;
    }

    _generateNewTargets();

    setState(() {
      _animateTowardsTargets();
    });
  }

  void _generateNewTargets() {
    final random = math.Random();

    for (int i = 0; i < totalBars; i++) {
      final double baseLevel = _displayLevel;
      final double groupActivity = _groupPatterns[i];

      double randomVariation = 0.5 + (random.nextDouble() * 0.5);

      randomVariation *= groupActivity;

      final double positionFactor = _getPositionWeight(i / (totalBars - 1));

      _targetHeights[i] = math.max(
        minBarHeight / maxBarHeight,
        (baseLevel * randomVariation * positionFactor).clamp(0.0, 1.0),
      );

      _animationSpeeds[i] = 0.3 + (random.nextDouble() * 0.4);
    }
  }

  void _generateGroupedPattern() {
    final random = math.Random();

    final int numGroups = 3 + random.nextInt(3);

    for (int i = 0; i < totalBars; i++) {
      _groupPatterns[i] = 0.2 + (random.nextDouble() * 0.3);
    }

    for (int g = 0; g < numGroups; g++) {
      final int groupCenter = random.nextInt(totalBars);
      final int groupWidth = 8 + random.nextInt(12);

      for (int i = 0; i < totalBars; i++) {
        final int distance = (i - groupCenter).abs();
        if (distance < groupWidth ~/ 2) {
          final double groupFactor = 1.0 - (distance / (groupWidth / 2));
          _groupPatterns[i] = math.max(
            _groupPatterns[i],
            0.6 + (groupFactor * 0.4),
          );
        }
      }
    }
  }

  void _evolveGroupPatterns() {
    for (int i = 0; i < totalBars; i++) {
      final double noise = (math.Random().nextDouble() - 0.5) * 0.01;
      _groupPatterns[i] = (_groupPatterns[i] + noise).clamp(0.1, 1.0);
    }
  }

  void _animateTowardsTargets() {
    for (int i = 0; i < totalBars; i++) {
      final double current = _waveformData[i];
      final double target = _targetHeights[i];
      final double speed = _animationSpeeds[i];

      final double difference = target - current;
      _waveformData[i] = current + (difference * speed);
    }
  }

  double _getPositionWeight(double position) {
    final double distanceFromCenter = (position - 0.5).abs() * 2.0;
    final double centerWeight =
        1.0 - (distanceFromCenter * distanceFromCenter * 0.6);
    return centerWeight.clamp(0.3, 1.0);
  }

  @override
  void didUpdateWidget(covariant AudioWaveVisualization oldWidget) {
    super.didUpdateWidget(oldWidget);
    final double target = widget.state == TranscriptionState.recording
        ? widget.audioLevel.clamp(0.0, 1.0)
        : 0.0;
    _animateTo(target);
  }

  void _animateTo(double target) {
    if (_animListener != null) {
      _animController.removeListener(_animListener!);
      _animListener = null;
    }

    final double begin = _displayLevel;
    final animation = Tween<double>(
      begin: begin,
      end: target,
    ).chain(CurveTween(curve: Curves.linear)).animate(_animController);

    _animController.reset();
    _animListener = () {
      if (mounted) {
        setState(() {
          _displayLevel = animation.value;
        });
      }
    };
    _animController.addListener(_animListener!);
    _animController.forward().whenComplete(() {
      if (_animListener != null) {
        _animController.removeListener(_animListener!);
        _animListener = null;
      }
    });
  }

  Widget _buildFullWidthWave() {
    return SizedBox(
      height: maxBarHeight,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final double availableWidth = constraints.maxWidth;
          final double barSpacing = 1.0;
          final double totalSpacing = barSpacing * (totalBars - 1);
          final double barWidth = (availableWidth - totalSpacing) / totalBars;

          return Row(
            mainAxisAlignment: MainAxisAlignment.start,
            children: List.generate(totalBars, (index) {
              final double normalizedHeight = _waveformData.length > index
                  ? _waveformData[index]
                  : minBarHeight / maxBarHeight;
              final double barHeight = normalizedHeight * maxBarHeight;

              return Row(
                children: [
                  _AudioBar(
                    height: math.max(minBarHeight, barHeight),
                    maxHeight: maxBarHeight,
                    width: barWidth.clamp(2.0, 8.0),
                  ),
                  if (index < totalBars - 1) SizedBox(width: barSpacing),
                ],
              );
            }),
          );
        },
      ),
    );
  }

  @override
  void dispose() {
    if (_animListener != null) {
      _animController.removeListener(_animListener!);
      _animListener = null;
    }
    _waveController.removeListener(_updateWaveform);
    _animController.dispose();
    _waveController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _buildFullWidthWave();
  }
}

class _AudioBar extends ConsumerWidget {
  final double height;
  final double maxHeight;
  final double width;

  const _AudioBar({
    required this.height,
    required this.maxHeight,
    required this.width,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = selectedTheme.colors(context);

    final duration = Duration(milliseconds: 1);

    final double heightRatio = height / maxHeight;
    final double opacity = (0.5 + (heightRatio * 0.5)).clamp(0.5, 1.0);

    return AnimatedContainer(
      duration: duration,
      curve: Curves.linear,
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: colors.accentBrand.withOpacity(opacity),
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }
}
