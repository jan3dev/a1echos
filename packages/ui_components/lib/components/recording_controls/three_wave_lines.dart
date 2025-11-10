import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:ui_components/config/theme_colors.dart';
import 'package:ui_components/config/colors.dart';
import 'package:ui_components/components/recording_controls/recording_controls_view.dart';

/// Three animated lines that respond to the audio level.
class AquaThreeWaveLines extends StatefulWidget {
  final double audioLevel;
  final double height;
  final AquaColors colors;
  final Duration animationDuration;
  final Duration waveDuration;
  final RecordingControlsState state;

  const AquaThreeWaveLines({
    super.key,
    this.audioLevel = 0.0,
    this.height = 42.0,
    required this.colors,
    this.animationDuration = const Duration(milliseconds: 12),
    this.waveDuration = const Duration(milliseconds: 12),
    this.state = RecordingControlsState.recording,
  });

  @override
  State<AquaThreeWaveLines> createState() => _AquaThreeWaveLinesState();
}

class _AquaThreeWaveLinesState extends State<AquaThreeWaveLines>
    with TickerProviderStateMixin {
  static const int _totalDataPoints = 120;

  final double _maxAmplitude = 20.0;
  final double _minAmplitude = 2.0;

  late final AnimationController _animController;
  late final AnimationController _waveController;
  late final List<_WaveState> _waves;

  double _displayLevel = 0.0;
  VoidCallback? _animListener;
  double _transcribingInversionTime = 0.0;
  double _oscillationStrength = 0.0; // Smoothly fades in/out (0.0 to 1.0)

  static final List<_WaveProfile> _profiles = [
    const _WaveProfile(
      basePhaseSpeed: 0.015,
      frequency: 2.2,
      verticalOffset: -3.2,
      amplitudeMultiplier: 0.5,
      strokeWidth: 3.0,
      energyFloor: 0.09,
      audioAmplitudeReactivity:
          0.8, // How much audio affects amplitude (0.0 - 1.0)
      audioSpeedReactivity: 1.0, // Speed multiplier based on audio level
      transcribingAmplitude: 0.6, // Amplitude in transcribing/loading state
      transcribingPhaseOffset: 0.0, // Phase offset for oscillation pattern
      audioOpacityReactivity: 0.1,
    ),
    const _WaveProfile(
      basePhaseSpeed: 0.04,
      frequency: 3.1,
      verticalOffset: 0.0,
      amplitudeMultiplier: 0.75,
      strokeWidth: 2.8,
      energyFloor: 0.07,
      audioAmplitudeReactivity: 1.0, // Most reactive to audio amplitude
      audioSpeedReactivity: 1.2, // Medium speed reactivity
      transcribingAmplitude: 0.7, // Amplitude in transcribing/loading state
      transcribingPhaseOffset: math.pi, // 180° offset - opposite direction
      audioOpacityReactivity: 0.05,
    ),
    const _WaveProfile(
      basePhaseSpeed: 0.06,
      frequency: 2.5,
      verticalOffset: 3.6,
      amplitudeMultiplier: 0.85,
      strokeWidth: 2.5,
      energyFloor: 0.06,
      audioAmplitudeReactivity: 0.5, // Less reactive to audio amplitude
      audioSpeedReactivity: 1.5, // Most reactive to audio speed
      transcribingAmplitude: 0.8, // Amplitude in transcribing/loading state
      transcribingPhaseOffset: (2 * math.pi) / 3, // 120° offset - in between
      audioOpacityReactivity: 0,
    ),
  ];

  double get _minNormalizedAmplitude => _minAmplitude / _maxAmplitude;

  @override
  void initState() {
    super.initState();
    _displayLevel = widget.audioLevel.clamp(0.0, 1.0);

    _animController = AnimationController(
      vsync: this,
      duration: widget.animationDuration,
    );

    _waveController = AnimationController(
      vsync: this,
      duration: widget.waveDuration,
    );
    _waveController.addListener(_updateWaveform);
    _waveController.repeat();

    _initializeWaves();
  }

  void _initializeWaves() {
    final double initialValue = _minNormalizedAmplitude;

    // Ensure distinct horizontal phase offsets for each wave
    // Larger offsets to prevent overlapping (0, π, 2π)
    final List<double> phaseOffsets = [
      0.0,
      math.pi,
      math.pi * 2,
    ];

    _waves = List.generate(
      _profiles.length,
      (index) => _WaveState(
        profile: _profiles[index],
        data: List<double>.filled(_totalDataPoints, initialValue),
        targets: List<double>.filled(_totalDataPoints, initialValue),
        phase: phaseOffsets[index % phaseOffsets.length],
      ),
      growable: false,
    );

    _generateNewTargets();
    for (final wave in _waves) {
      for (int i = 0; i < _totalDataPoints; i++) {
        wave.data[i] = wave.targets[i];
      }
    }
  }

  @override
  void didUpdateWidget(covariant AquaThreeWaveLines oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.audioLevel != oldWidget.audioLevel) {
      _animateTo(widget.audioLevel.clamp(0.0, 1.0));
    }
  }

  void _updateWaveform() {
    if (!mounted) return;

    // Update transcribing oscillation time and strength
    if (widget.state == RecordingControlsState.transcribing ||
        widget.state == RecordingControlsState.loading) {
      _transcribingInversionTime += 0.016; // ~60fps
      // Smoothly fade in oscillation strength
      if (_oscillationStrength < 1.0) {
        _oscillationStrength += 0.05; // Smooth fade in
        if (_oscillationStrength > 1.0) _oscillationStrength = 1.0;
      }
    } else {
      // Smoothly fade out oscillation strength
      if (_oscillationStrength > 0.0) {
        _oscillationStrength -= 0.05; // Smooth fade out (matches fade in speed)
        if (_oscillationStrength < 0.0) {
          _oscillationStrength = 0.0;
          _transcribingInversionTime = 0.0;
        }
      } else {
        _transcribingInversionTime = 0.0;
      }
    }

    for (final wave in _waves) {
      final profile = wave.profile;

      // Calculate phase step based on state
      final double phaseStep = _calculatePhaseStep(profile);
      wave.phase = (wave.phase + phaseStep) % (math.pi * 2);
    }

    _generateNewTargets();

    setState(_animateTowardsTargets);
  }

  double _calculatePhaseStep(_WaveProfile profile) {
    switch (widget.state) {
      case RecordingControlsState.ready:
        // Slow horizontal movement
        return profile.basePhaseSpeed * 0.3;

      case RecordingControlsState.recording:
        // Much faster horizontal movement, scaled by audio level
        // Use per-wave audio speed reactivity
        final double baseSpeed = profile.basePhaseSpeed * 4.0;
        final double audioSpeedMultiplier =
            1.0 + (_displayLevel * profile.audioSpeedReactivity);
        return baseSpeed * audioSpeedMultiplier;

      case RecordingControlsState.transcribing:
      case RecordingControlsState.loading:
        return profile.basePhaseSpeed * 0.3;
    }
  }

  void _generateNewTargets() {
    for (final wave in _waves) {
      final profile = wave.profile;
      for (int i = 0; i < _totalDataPoints; i++) {
        // Calculate base energy based on state
        final double baseEnergy = _getBaseEnergyForState(profile);

        // Apply position weight only in recording state for dynamic behavior
        final double positionWeight =
            widget.state == RecordingControlsState.recording
                ? _getPositionWeight(i / (_totalDataPoints - 1))
                : 1.0; // Constant amplitude in non-recording states

        // Apply state-specific amplitude multiplier
        final double stateAmplitudeMultiplier =
            _getStateAmplitudeMultiplier(profile);

        final double target =
            (baseEnergy * stateAmplitudeMultiplier * positionWeight)
                .clamp(0.0, 1.0);

        final double previousTarget = wave.targets[i];
        final double smoothedTarget = (previousTarget * 0.85) + (target * 0.15);

        wave.targets[i] =
            math.max(_minNormalizedAmplitude, smoothedTarget.clamp(0.0, 1.0));
      }
    }
  }

  double _getBaseEnergyForState(_WaveProfile profile) {
    switch (widget.state) {
      case RecordingControlsState.ready:
        // Non-reactive to audio, use a fixed moderate energy level
        return 0.5;

      case RecordingControlsState.transcribing:
      case RecordingControlsState.loading:
        // Maximum amplitude for transcribing/loading states
        return 1.0;

      case RecordingControlsState.recording:
        // Audio-reactive with per-wave reactivity
        // Blend between energy floor and audio level based on reactivity
        final double audioReactiveEnergy = _displayLevel.clamp(0.0, 1.0);
        final double blendedEnergy = profile.energyFloor +
            (audioReactiveEnergy * profile.audioAmplitudeReactivity);
        return blendedEnergy.clamp(profile.energyFloor, 1.0);
    }
  }

  double _getStateAmplitudeMultiplier(_WaveProfile profile) {
    switch (widget.state) {
      case RecordingControlsState.ready:
        // Higher amplitude for ready state
        return profile.amplitudeMultiplier * 1.5;

      case RecordingControlsState.transcribing:
      case RecordingControlsState.loading:
        // Use individual transcribing amplitude for distinct wave heights
        return profile.transcribingAmplitude;

      case RecordingControlsState.recording:
        // Normal amplitude for recording
        return profile.amplitudeMultiplier;
    }
  }

  void _animateTowardsTargets() {
    for (final wave in _waves) {
      for (int i = 0; i < _totalDataPoints; i++) {
        final double diff = wave.targets[i] - wave.data[i];
        // Faster transition speed for more responsive animations
        const double speed = 0.2;
        wave.data[i] =
            (wave.data[i] + (diff * speed)).clamp(_minNormalizedAmplitude, 1.0);
      }
    }
  }

  double _getPositionWeight(double position) {
    final double distanceFromCenter = (position - 0.5).abs() * 2.0;
    final double centerWeight =
        1.0 - (distanceFromCenter * distanceFromCenter * 0.5);
    return centerWeight.clamp(0.4, 1.0);
  }

  void _animateTo(double target) {
    if (_animListener != null) {
      _animController.removeListener(_animListener!);
      _animListener = null;
    }

    final double begin = _displayLevel;
    final animation = Tween<double>(begin: begin, end: target)
        .chain(CurveTween(curve: Curves.easeOutCubic))
        .animate(_animController);

    _animListener = () {
      if (mounted) {
        setState(() {
          _displayLevel = animation.value;
        });
      }
    };

    _animController
      ..reset()
      ..addListener(_animListener!);

    _animController.forward().whenComplete(() {
      if (_animListener != null) {
        _animController.removeListener(_animListener!);
        _animListener = null;
      }
    });
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

  Color _resolveWaveColor(int index) {
    final profile = _waves[index].profile;
    
    // Base opacity based on state
    double stateOpacity;
    if (widget.state == RecordingControlsState.transcribing ||
        widget.state == RecordingControlsState.loading) {
      stateOpacity = 0.5;
    } else if (widget.state == RecordingControlsState.recording) {
      // Audio-reactive opacity in recording state
      // Base opacity + (audio level * reactivity weight)
      const double baseOpacity = 0.75;
      const double maxOpacity = 1.0;
      final double audioBoost = _displayLevel * profile.audioOpacityReactivity;
      stateOpacity = (baseOpacity + audioBoost).clamp(baseOpacity, maxOpacity);
    } else {
      // Ready state
      stateOpacity = 0.75;
    }

    switch (index) {
      case 0:
        return AquaPrimitiveColors.waveOrange.withOpacity(stateOpacity);
      case 1:
        return widget.colors.accentBrand.withOpacity(stateOpacity);
      case 2:
        return AquaPrimitiveColors.waveCyan.withOpacity(stateOpacity);
      default:
        return widget.colors.accentBrand.withOpacity(stateOpacity);
    }
  }

  @override
  Widget build(BuildContext context) {
    final waveSnapshots = List.generate(
      _waves.length,
      (index) {
        final wave = _waves[index];
        final profile = wave.profile;

        // Calculate dynamic vertical offset based on state and audio level
        final double dynamicVerticalOffset = _calculateDynamicVerticalOffset(
          profile.verticalOffset,
          index,
        );

        // Calculate phase inversion with individual offset for symmetrical pattern
        final double oscillation = math.sin(
            _transcribingInversionTime * (math.pi / 3.0) +
                profile.transcribingPhaseOffset);
        // Blend between no oscillation (1.0) and full oscillation based on strength
        final double individualPhaseInversion =
            1.0 + (oscillation - 1.0) * _oscillationStrength;

        return _WaveRenderSnapshot(
          data: wave.data,
          phase: wave.phase,
          frequency: profile.frequency,
          verticalOffset: dynamicVerticalOffset,
          strokeWidth: profile.strokeWidth,
          color: _resolveWaveColor(index),
          phaseInversion: individualPhaseInversion,
        );
      },
      growable: false,
    );

    return SizedBox(
      height: widget.height,
      child: LayoutBuilder(
        builder: (context, constraints) {
          return CustomPaint(
            painter: _ThreeWavePainter(
              waves: waveSnapshots,
              height: widget.height,
              maxAmplitude: _maxAmplitude,
              minAmplitude: _minAmplitude,
            ),
            size: Size(constraints.maxWidth, widget.height),
          );
        },
      ),
    );
  }

  double _calculateDynamicVerticalOffset(double baseOffset, int waveIndex) {
    if (widget.state != RecordingControlsState.recording) {
      // No convergence in non-recording states
      return baseOffset;
    }

    // In recording state, waves converge toward center as audio level increases
    // Higher audio level = smaller vertical offset (closer to center)
    final double convergenceFactor = 1.0 - (_displayLevel * 0.7);
    return baseOffset * convergenceFactor;
  }
}

class _WaveProfile {
  const _WaveProfile({
    required this.basePhaseSpeed,
    required this.frequency,
    required this.verticalOffset,
    required this.amplitudeMultiplier,
    required this.strokeWidth,
    required this.energyFloor,
    required this.audioAmplitudeReactivity,
    required this.audioSpeedReactivity,
    required this.transcribingAmplitude,
    required this.transcribingPhaseOffset,
    required this.audioOpacityReactivity,
  });

  final double basePhaseSpeed;
  final double frequency;
  final double verticalOffset;
  final double amplitudeMultiplier;
  final double strokeWidth;
  final double energyFloor;

  /// How much audio level affects the amplitude of this wave (0.0 - 1.0+)
  /// Higher values = more responsive to audio
  final double audioAmplitudeReactivity;

  /// How much audio level affects the speed of this wave (multiplier)
  /// Higher values = faster movement when audio is present
  final double audioSpeedReactivity;

  /// Amplitude multiplier specifically for transcribing/loading state
  /// Allows independent control of wave height in this state
  final double transcribingAmplitude;

  /// Phase offset for transcribing oscillation pattern (in radians)
  /// Allows waves to oscillate in opposite directions symmetrically
  final double transcribingPhaseOffset;

  /// How much audio level affects the opacity of this wave (0.0 - 1.0+)
  /// Higher values = more opacity change with audio volume
  final double audioOpacityReactivity;
}

class _WaveState {
  _WaveState({
    required this.profile,
    required this.data,
    required this.targets,
    required this.phase,
  });

  final _WaveProfile profile;
  final List<double> data;
  final List<double> targets;
  double phase;
}

class _WaveRenderSnapshot {
  const _WaveRenderSnapshot({
    required this.data,
    required this.phase,
    required this.frequency,
    required this.verticalOffset,
    required this.strokeWidth,
    required this.color,
    required this.phaseInversion,
  });

  final List<double> data;
  final double phase;
  final double frequency;
  final double verticalOffset;
  final double strokeWidth;
  final Color color;
  final double phaseInversion;
}

class _ThreeWavePainter extends CustomPainter {
  _ThreeWavePainter({
    required this.waves,
    required this.height,
    required this.maxAmplitude,
    required this.minAmplitude,
  });

  final List<_WaveRenderSnapshot> waves;
  final double height;
  final double maxAmplitude;
  final double minAmplitude;

  @override
  void paint(Canvas canvas, Size size) {
    final double centerY = height / 2;
    final double amplitudeRange = maxAmplitude - minAmplitude;

    for (final wave in waves) {
      _drawWave(
        canvas,
        size,
        wave: wave,
        centerY: centerY + wave.verticalOffset,
        amplitudeRange: amplitudeRange,
      );
    }
  }

  void _drawWave(
    Canvas canvas,
    Size size, {
    required _WaveRenderSnapshot wave,
    required double centerY,
    required double amplitudeRange,
  }) {
    if (wave.data.isEmpty) return;

    final paint = Paint()
      ..color = wave.color
      ..style = PaintingStyle.stroke
      ..strokeWidth = wave.strokeWidth
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final path = Path();
    final double width = size.width;
    final int points = wave.data.length;

    // Apply phase inversion for transcribing/loading state
    final double phaseInversion = wave.phaseInversion;

    for (int i = 0; i < points; i++) {
      final double normalizedX = i / (points - 1);
      final double x = normalizedX * width;

      final double normalizedAmplitude = wave.data[i].clamp(0.0, 1.0);
      final double amplitude =
          minAmplitude + (normalizedAmplitude * amplitudeRange);
      final double sine =
          math.sin(wave.frequency * 2 * math.pi * normalizedX + wave.phase);
      final double energyFactor = 0.65 + (normalizedAmplitude * 0.35);
      // Apply phase inversion to create up/down oscillation
      final double y =
          centerY + (amplitude * energyFactor * sine * phaseInversion);

      if (i == 0) {
        path.moveTo(x, y);
      } else {
        final double prevNormalizedX = (i - 1) / (points - 1);
        final double prevX = prevNormalizedX * width;
        final double prevNormalizedAmplitude = wave.data[i - 1].clamp(0.0, 1.0);
        final double prevAmplitude =
            minAmplitude + (prevNormalizedAmplitude * amplitudeRange);
        final double prevSine = math.sin(
          wave.frequency * 2 * math.pi * prevNormalizedX + wave.phase,
        );
        final double prevEnergyFactor = 0.65 + (prevNormalizedAmplitude * 0.35);
        final double prevY = centerY +
            (prevAmplitude * prevEnergyFactor * prevSine * phaseInversion);

        final double controlX1 = prevX + (x - prevX) * 0.33;
        final double controlX2 = prevX + (x - prevX) * 0.66;
        final double controlY1 = prevY + (y - prevY) * 0.33;
        final double controlY2 = prevY + (y - prevY) * 0.66;

        path.cubicTo(controlX1, controlY1, controlX2, controlY2, x, y);
      }
    }

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _ThreeWavePainter oldDelegate) => true;
}
