import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart' as provider;
import 'package:flutter_svg/flutter_svg.dart';
import 'package:ui_components/ui_components.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/local_transcription_provider.dart';
import '../providers/transcription_state_manager.dart';
import '../providers/theme_provider.dart';
import '../models/app_theme.dart';
import '../logger.dart';

class RecordingButton extends ConsumerStatefulWidget {
  final VoidCallback? onRecordingStart;
  final VoidCallback? onRecordingStop;
  final bool isRecording;
  final bool useProviderState;

  const RecordingButton({
    super.key,
    this.onRecordingStart,
    this.onRecordingStop,
    this.isRecording = false,
    this.useProviderState = true,
  });

  @override
  ConsumerState<RecordingButton> createState() => _RecordingButtonState();
}

class _RecordingButtonState extends ConsumerState<RecordingButton>
    with TickerProviderStateMixin {
  bool _isDebouncing = false;
  bool _gestureIsolationActive = false;
  Timer? _debounceTimer;
  Timer? _gestureIsolationTimer;
  DateTime? _lastActionTime;
  String? _lastActionType;
  TranscriptionState? _lastKnownState;

  late AnimationController _scaleController;
  late Animation<double> _scaleAnimation;

  AnimationController? _glowController;
  Animation<double>? _glowAnimation;

  Timer? _scaleAnimationDelayTimer;

  static const Duration _debounceDuration = Duration(milliseconds: 800);
  static const Duration _minimumActionInterval = Duration(milliseconds: 1200);
  static const Duration _gestureIsolationDuration = Duration(
    milliseconds: 2000,
  );
  static const Duration _scaleAnimationDelay = Duration(milliseconds: 300);

  @override
  void initState() {
    super.initState();
    _scaleController = AnimationController(
      duration: const Duration(milliseconds: 250),
      vsync: this,
    );
    _scaleAnimation = Tween<double>(
      begin: 1.0,
      end: 1.15,
    ).animate(CurvedAnimation(parent: _scaleController, curve: Curves.easeOut));

    _glowController = AnimationController(
      duration: const Duration(milliseconds: 2000),
      vsync: this,
    )..repeat(reverse: true);
    _glowAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _glowController!, curve: Curves.easeInOut),
    );
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

  /// Triggers delayed scale animation for state changes (after navigation)
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

    if (_isDebouncing && _lastActionType == actionName) {
      return;
    }

    final now = DateTime.now();
    if (_lastActionTime != null) {
      final timeSinceLastAction = now.difference(_lastActionTime!);
      if (timeSinceLastAction < _minimumActionInterval) {
        return;
      }
    }

    if (!mounted) return;

    setState(() {
      _isDebouncing = true;
      _lastActionType = actionName;
      _gestureIsolationActive = true;
    });
    _lastActionTime = now;

    try {
      await action();

      _debounceTimer?.cancel();
      _debounceTimer = Timer(_debounceDuration, () {
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
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.ui,
        message: 'Error handling recording action: $actionName',
      );
    } finally {
      _gestureIsolationTimer?.cancel();
      _gestureIsolationTimer = Timer(_gestureIsolationDuration, () {
        if (mounted) {
          setState(() => _gestureIsolationActive = false);
        }
      });
    }
  }

  /// Handles start recording action with validation and haptic feedback
  Future<void> _handleStartRecording(
    LocalTranscriptionProvider? provider,
  ) async {
    HapticFeedback.mediumImpact();

    await _handleRecordingAction(() async {
      if (widget.onRecordingStart != null) {
        widget.onRecordingStart!();
      } else if (provider != null) {
        final success = await provider.startRecording();
        if (!success) {
          throw Exception('Failed to start recording - system may be busy');
        }
      }
    }, 'Start Recording');
  }

  /// Handles stop recording action with validation, haptic feedback, and smooth animation
  Future<void> _handleStopRecording(
    LocalTranscriptionProvider? provider,
  ) async {
    _triggerScaleAnimation();

    HapticFeedback.lightImpact();

    await _handleRecordingAction(() async {
      if (widget.onRecordingStop != null) {
        widget.onRecordingStop!();
      } else if (provider != null) {
        await provider.stopRecordingAndSave();
      }
    }, 'Stop Recording');
  }

  @override
  Widget build(BuildContext context) {
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = selectedTheme.colors(context);

    if (widget.useProviderState) {
      return provider.Consumer<LocalTranscriptionProvider>(
        builder: (context, provider, child) {
          final state = provider.state;

          if (_lastKnownState != state) {
            _lastKnownState = state;
            if (state == TranscriptionState.ready ||
                state == TranscriptionState.error) {
              _gestureIsolationActive = false;
            }

            if (state == TranscriptionState.recording) {
              _triggerDelayedScaleAnimation();
              _glowController?.forward();
            } else {
              _scaleAnimationDelayTimer?.cancel();
              _scaleController.reverse();
              _glowController?.reverse();
            }
          }

          return _buildButtonForState(state, colors, provider);
        },
      );
    } else {
      final state = widget.isRecording
          ? TranscriptionState.recording
          : TranscriptionState.ready;

      if (_lastKnownState != state) {
        _lastKnownState = state;
        if (state == TranscriptionState.recording) {
          _triggerDelayedScaleAnimation();
          _glowController?.forward();
        } else {
          _scaleAnimationDelayTimer?.cancel();
          _scaleController.reverse();
          _glowController?.reverse();
        }
      }

      return _buildButtonForState(state, colors, null);
    }
  }

  Widget _buildButtonForState(
    TranscriptionState state,
    AquaColors colors,
    LocalTranscriptionProvider? provider,
  ) {
    return AnimatedBuilder(
      animation: _scaleAnimation,
      builder: (context, child) {
        return Transform.scale(
          scale: _scaleAnimation.value,
          child: _buildButtonContainer(state, colors, provider),
        );
      },
    );
  }

  Widget _buildButtonContainer(
    TranscriptionState state,
    AquaColors colors,
    LocalTranscriptionProvider? provider,
  ) {
    switch (state) {
      case TranscriptionState.loading:
      case TranscriptionState.error:
      case TranscriptionState.transcribing:
        return Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            color: colors.glassInverse.withOpacity(0.5),
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: colors.glassInverse.withOpacity(0.04),
                blurRadius: 16,
                offset: const Offset(0, 0),
              ),
            ],
          ),
          child: Center(
            child: SvgPicture.asset(
              'assets/icons/mic.svg',
              width: 24,
              height: 24,
              colorFilter: ColorFilter.mode(
                colors.textInverse,
                BlendMode.srcIn,
              ),
            ),
          ),
        );
      case TranscriptionState.recording:
        if (_glowAnimation != null) {
          return AnimatedBuilder(
            animation: _glowAnimation!,
            builder: (context, child) {
              return Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: colors.accentBrand,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: colors.accentBrand.withOpacity(
                        0.3 + _glowAnimation!.value * 0.4,
                      ),
                      blurRadius: 24 + _glowAnimation!.value * 16,
                      offset: const Offset(0, 0),
                    ),
                    BoxShadow(
                      color: colors.accentBrand.withOpacity(
                        _glowAnimation!.value * 0.2,
                      ),
                      blurRadius: 8 + _glowAnimation!.value * 8,
                      offset: const Offset(0, 0),
                    ),
                  ],
                ),
                child: IconButton(
                  onPressed: (_isDebouncing || _gestureIsolationActive)
                      ? null
                      : () => _handleStopRecording(provider),
                  icon: SvgPicture.asset(
                    'assets/icons/rectangle.svg',
                    width: 14,
                    height: 14,
                    colorFilter: ColorFilter.mode(
                      colors.textInverse,
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
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: colors.accentBrand,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: colors.accentBrand.withOpacity(0.3),
                  blurRadius: 24,
                  offset: const Offset(0, 0),
                ),
              ],
            ),
            child: IconButton(
              onPressed: (_isDebouncing || _gestureIsolationActive)
                  ? null
                  : () => _handleStopRecording(provider),
              icon: SvgPicture.asset(
                'assets/icons/rectangle.svg',
                width: 14,
                height: 14,
                colorFilter: ColorFilter.mode(
                  colors.textInverse,
                  BlendMode.srcIn,
                ),
              ),
            ),
          );
        }
      case TranscriptionState.ready:
        return Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            color: colors.glassInverse,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: colors.glassInverse.withOpacity(0.04),
                blurRadius: 16,
                offset: const Offset(0, 0),
              ),
            ],
          ),
          child: IconButton(
            onPressed: (_isDebouncing || _gestureIsolationActive)
                ? null
                : () => _handleStartRecording(provider),
            icon: SvgPicture.asset(
              'assets/icons/mic.svg',
              width: 24,
              height: 24,
              colorFilter: ColorFilter.mode(
                colors.textInverse,
                BlendMode.srcIn,
              ),
            ),
          ),
        );
    }
  }
}
