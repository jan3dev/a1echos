import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Enum representing the different states of the recording button
enum RecordingButtonState {
  /// Button is ready to start recording
  ready,

  /// Currently recording
  recording,

  /// Transcribing the recording
  transcribing,

  /// Loading or error state
  loading,
}

/// A reusable recording button component for the design system
class AquaRecordingButton extends StatefulWidget {
  /// Callback when recording should start
  final VoidCallback? onRecordingStart;

  /// Callback when recording should stop
  final VoidCallback? onRecordingStop;

  /// Current state of the recording button
  final RecordingButtonState state;

  /// Whether the button is enabled
  final bool enabled;

  /// Size of the button (diameter)
  final double size;

  /// Duration for scale animation
  final Duration scaleAnimationDuration;

  /// Duration for glow animation cycle
  final Duration glowAnimationDuration;

  /// Debounce duration between actions
  final Duration debounceDuration;

  const AquaRecordingButton({
    super.key,
    this.onRecordingStart,
    this.onRecordingStop,
    this.state = RecordingButtonState.ready,
    this.enabled = true,
    this.size = 64.0,
    this.scaleAnimationDuration = const Duration(milliseconds: 250),
    this.glowAnimationDuration = const Duration(milliseconds: 2000),
    this.debounceDuration = const Duration(milliseconds: 800),
  });

  @override
  State<AquaRecordingButton> createState() => _AquaRecordingButtonState();
}

class _AquaRecordingButtonState extends State<AquaRecordingButton>
    with TickerProviderStateMixin {
  bool _isDebouncing = false;
  bool _gestureIsolationActive = false;
  Timer? _debounceTimer;
  Timer? _gestureIsolationTimer;

  late AnimationController _scaleController;
  late Animation<double> _scaleAnimation;

  AnimationController? _glowController;
  Animation<double>? _glowAnimation;

  Timer? _scaleAnimationDelayTimer;

  static const Duration _scaleAnimationDelay = Duration(milliseconds: 300);
  static const Duration _gestureIsolationDuration =
      Duration(milliseconds: 2000);

  @override
  void initState() {
    super.initState();
    _scaleController = AnimationController(
      duration: widget.scaleAnimationDuration,
      vsync: this,
    );
    _scaleAnimation = Tween<double>(
      begin: 1.0,
      end: 1.15,
    ).animate(CurvedAnimation(parent: _scaleController, curve: Curves.easeOut));

    _glowController = AnimationController(
      duration: widget.glowAnimationDuration,
      vsync: this,
    );
    _glowAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _glowController!, curve: Curves.easeInOut),
    );

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _handleInitialState();
    });
  }

  @override
  void didUpdateWidget(AquaRecordingButton oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (oldWidget.state != widget.state) {
      if (widget.state == RecordingButtonState.ready) {
        _gestureIsolationActive = false;
      }

      if (widget.state == RecordingButtonState.recording) {
        _triggerDelayedScaleAnimation();
        _glowController?.repeat(reverse: true);
      } else {
        _scaleAnimationDelayTimer?.cancel();
        _scaleController.reverse();
        _glowController?.reset();
      }
    }
  }

  @override
  void dispose() {
    _scaleController.dispose();
    _glowController?.dispose();
    _debounceTimer?.cancel();
    _gestureIsolationTimer?.cancel();
    _scaleAnimationDelayTimer?.cancel();
    super.dispose();
  }

  /// Triggers smooth scale animation for visual feedback
  void _triggerScaleAnimation() {
    if (_scaleController.isAnimating) return;
    _scaleController.forward().then((_) {
      _scaleController.reverse();
    });
  }

  /// Handles initial state when widget is first created
  void _handleInitialState() {
    if (!mounted) return;

    if (widget.state == RecordingButtonState.recording) {
      _triggerDelayedScaleAnimation();
      _glowController?.repeat(reverse: true);
    }
  }

  /// Triggers delayed scale animation for state changes (stays grown during recording)
  void _triggerDelayedScaleAnimation() {
    _scaleAnimationDelayTimer?.cancel();
    _scaleAnimationDelayTimer = Timer(_scaleAnimationDelay, () {
      if (mounted && !_scaleController.isAnimating) {
        _scaleController.forward();
      }
    });
  }

  /// Handles recording actions with enhanced debouncing and validation
  Future<void> _handleRecordingAction(
    Future<void> Function() action,
    String actionName,
  ) async {
    if (_gestureIsolationActive) {
      return;
    }

    if (_isDebouncing) {
      return;
    }

    if (!mounted) return;

    setState(() {
      _isDebouncing = true;
      _gestureIsolationActive = true;
    });

    try {
      await action();

      _debounceTimer?.cancel();
      _debounceTimer = Timer(widget.debounceDuration, () {
        if (mounted) {
          setState(() => _isDebouncing = false);
        }
      });

      _gestureIsolationTimer?.cancel();
      _gestureIsolationTimer = Timer(_gestureIsolationDuration, () {
        if (mounted) {
          setState(() => _gestureIsolationActive = false);
        }
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _isDebouncing = false;
          _gestureIsolationActive = false;
        });
      }
    }
  }

  /// Handles start recording action
  Future<void> _handleStartRecording() async {
    if (widget.onRecordingStart != null) {
      HapticFeedback.mediumImpact();
      await _handleRecordingAction(() async {
        widget.onRecordingStart!();
      }, 'Start Recording');
    }
  }

  /// Handles stop recording action
  Future<void> _handleStopRecording() async {
    if (widget.onRecordingStop != null) {
      _triggerScaleAnimation();
      HapticFeedback.lightImpact();
      await _handleRecordingAction(() async {
        widget.onRecordingStop!();
      }, 'Stop Recording');
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _scaleAnimation,
      builder: (context, child) {
        return Transform.scale(
          scale: _scaleAnimation.value,
          child: _buildButtonContainer(),
        );
      },
    );
  }

  Widget _buildButtonContainer() {
    final colorScheme = Theme.of(context).colorScheme;

    switch (widget.state) {
      case RecordingButtonState.loading:
      case RecordingButtonState.transcribing:
        return _buildTranscribingButton(colorScheme);
      case RecordingButtonState.recording:
        return _buildRecordingButton(colorScheme);
      case RecordingButtonState.ready:
        return _buildReadyButton(colorScheme);
    }
  }

  Widget _buildTranscribingButton(ColorScheme colorScheme) {
    return Opacity(
      opacity: 0.5,
      child: Container(
        width: widget.size,
        height: widget.size,
        decoration: BoxDecoration(
          color: colorScheme.onSurface,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: colorScheme.onSurface.withOpacity(0.04),
              blurRadius: 16,
              offset: const Offset(0, 0),
            ),
          ],
        ),
        child: IconButton(
          onPressed: null, // Disabled during transcribing/loading
          icon: SvgPicture.asset(
            'assets/svgs/mic.svg',
            package: 'ui_components',
            width: 24,
            height: 24,
            colorFilter: ColorFilter.mode(
              colorScheme.surface,
              BlendMode.srcIn,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildRecordingButton(ColorScheme colorScheme) {
    if (_glowAnimation != null) {
      return AnimatedBuilder(
        animation: _glowAnimation!,
        builder: (context, child) {
          return Container(
            width: widget.size,
            height: widget.size,
            decoration: BoxDecoration(
              color: colorScheme.primary,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: colorScheme.primary.withOpacity(
                    0.3 + _glowAnimation!.value * 0.4,
                  ),
                  blurRadius: 24 + _glowAnimation!.value * 16,
                  offset: const Offset(0, 0),
                ),
                BoxShadow(
                  color: colorScheme.primary.withOpacity(
                    _glowAnimation!.value * 0.2,
                  ),
                  blurRadius: 8 + _glowAnimation!.value * 8,
                  offset: const Offset(0, 0),
                ),
              ],
            ),
            child: IconButton(
              onPressed:
                  (_isDebouncing || _gestureIsolationActive || !widget.enabled)
                      ? null
                      : _handleStopRecording,
              icon: SvgPicture.asset(
                'assets/svgs/rectangle.svg',
                package: 'ui_components',
                width: 14,
                height: 14,
                colorFilter: ColorFilter.mode(
                  colorScheme.onPrimary,
                  BlendMode.srcIn,
                ),
              ),
            ),
          );
        },
      );
    } else {
      // Fallback when glow animation is not initialized yet
      return Container(
        width: widget.size,
        height: widget.size,
        decoration: BoxDecoration(
          color: colorScheme.primary,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: colorScheme.primary.withOpacity(0.3),
              blurRadius: 24,
              offset: const Offset(0, 0),
            ),
          ],
        ),
        child: IconButton(
          onPressed:
              (_isDebouncing || _gestureIsolationActive || !widget.enabled)
                  ? null
                  : _handleStopRecording,
          icon: SvgPicture.asset(
            'assets/svgs/rectangle.svg',
            package: 'ui_components',
            width: 14,
            height: 14,
            colorFilter: ColorFilter.mode(
              colorScheme.onPrimary,
              BlendMode.srcIn,
            ),
          ),
        ),
      );
    }
  }

  Widget _buildReadyButton(ColorScheme colorScheme) {
    return Container(
      width: widget.size,
      height: widget.size,
      decoration: BoxDecoration(
        color: colorScheme.onSurface,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: colorScheme.onSurface.withOpacity(0.04),
            blurRadius: 16,
            offset: const Offset(0, 0),
          ),
        ],
      ),
      child: IconButton(
        onPressed: (_isDebouncing || _gestureIsolationActive || !widget.enabled)
            ? null
            : _handleStartRecording,
        icon: SvgPicture.asset(
          'assets/svgs/mic.svg',
          package: 'ui_components',
          width: 24,
          height: 24,
          colorFilter: ColorFilter.mode(
            colorScheme.surface,
            BlendMode.srcIn,
          ),
        ),
      ),
    );
  }
}
