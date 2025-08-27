import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/local_transcription_provider.dart';
import '../providers/transcription_state_manager.dart';
import '../providers/theme_provider.dart';
import '../models/app_theme.dart';
import 'recording_button/recording_button_constants.dart';
import 'recording_button/recording_button_gesture_handler.dart';
import 'recording_button/recording_button_action_handler.dart';
import 'recording_button/recording_button_ui_builder.dart';

class RecordingButton extends ConsumerStatefulWidget {
  /// Callback that gets triggered when recording is started
  final VoidCallback? onRecordingStart;

  /// Callback that gets triggered when recording is stopped
  final VoidCallback? onRecordingStop;

  /// Callback that gets triggered when lock indicator should be shown/hidden
  final ValueChanged<bool>? onLockIndicatorVisibilityChanged;

  /// Callback that provides lock indicator progress (0.0 to 1.0)
  final ValueChanged<double>? onLockIndicatorProgressChanged;

  /// Callback that gets triggered when lock state changes
  final ValueChanged<bool>? onLockStateChanged;

  /// Whether the button should show in recording state
  final bool isRecording;

  /// Whether to use the provider for state or rely on passed parameters
  final bool useProviderState;

  const RecordingButton({
    super.key,
    this.onRecordingStart,
    this.onRecordingStop,
    this.onLockIndicatorVisibilityChanged,
    this.onLockIndicatorProgressChanged,
    this.onLockStateChanged,
    this.isRecording = false,
    this.useProviderState = true,
  });

  @override
  ConsumerState<RecordingButton> createState() => _RecordingButtonState();
}

class _RecordingButtonState extends ConsumerState<RecordingButton>
    with
        TickerProviderStateMixin,
        RecordingButtonGestureHandler,
        RecordingButtonActionHandler,
        RecordingButtonUIBuilder {
  bool _isDebouncing = false;
  bool _gestureIsolationActive = false;
  Timer? _debounceTimer;
  Timer? _gestureIsolationTimer;
  DateTime? _lastActionTime;
  String? _lastActionType;
  TranscriptionState? _lastKnownState;

  bool _isLongPressing = false;
  bool _isLongPressRecording = false;
  Timer? _longPressTimer;

  bool _isPanning = false;
  bool _isLocked = false;
  double _panStartY = 0.0;
  double _currentPanY = 0.0;
  double _dragOffsetY = 0.0;

  late AnimationController _scaleController;
  late Animation<double> _scaleAnimation;
  late AnimationController _lockIndicatorController;
  late Animation<double> _lockIndicatorAnimation;

  @override
  bool get isLongPressing => _isLongPressing;
  @override
  bool get isLongPressRecording => _isLongPressRecording;
  @override
  bool get isPanning => _isPanning;
  @override
  bool get isLocked => _isLocked;
  @override
  double get panStartY => _panStartY;
  @override
  double get currentPanY => _currentPanY;
  @override
  double get dragOffsetY => _dragOffsetY;
  @override
  Timer? get longPressTimer => _longPressTimer;
  @override
  AnimationController get lockIndicatorController => _lockIndicatorController;
  @override
  VoidCallback? get onRecordingStart => widget.onRecordingStart;
  @override
  VoidCallback? get onRecordingStop => widget.onRecordingStop;
  @override
  ValueChanged<bool>? get onLockIndicatorVisibilityChanged =>
      widget.onLockIndicatorVisibilityChanged;
  @override
  ValueChanged<double>? get onLockIndicatorProgressChanged =>
      widget.onLockIndicatorProgressChanged;
  @override
  ValueChanged<bool>? get onLockStateChanged => widget.onLockStateChanged;

  @override
  set isLongPressing(bool value) => _isLongPressing = value;
  @override
  set isLongPressRecording(bool value) => _isLongPressRecording = value;
  @override
  set isPanning(bool value) => _isPanning = value;
  @override
  set isLocked(bool value) => _isLocked = value;
  @override
  set panStartY(double value) => _panStartY = value;
  @override
  set currentPanY(double value) => _currentPanY = value;
  @override
  set dragOffsetY(double value) => _dragOffsetY = value;

  @override
  bool get isDebouncing => _isDebouncing;
  @override
  bool get gestureIsolationActive => _gestureIsolationActive;
  @override
  Timer? get debounceTimer => _debounceTimer;
  @override
  Timer? get gestureIsolationTimer => _gestureIsolationTimer;
  @override
  DateTime? get lastActionTime => _lastActionTime;
  @override
  String? get lastActionType => _lastActionType;

  @override
  set isDebouncing(bool value) => _isDebouncing = value;
  @override
  set gestureIsolationActive(bool value) => _gestureIsolationActive = value;
  @override
  set debounceTimer(Timer? value) => _debounceTimer = value;
  @override
  set gestureIsolationTimer(Timer? value) => _gestureIsolationTimer = value;
  @override
  set lastActionTime(DateTime? value) => _lastActionTime = value;
  @override
  set lastActionType(String? value) => _lastActionType = value;

  @override
  Animation<double> get scaleAnimation => _scaleAnimation;

  @override
  void Function(LongPressStartDetails, LocalTranscriptionProvider?)
  get onLongPressStartHandler => onLongPressStart;
  @override
  void Function(LongPressMoveUpdateDetails) get onLongPressMoveUpdateHandler =>
      onLongPressMoveUpdate;
  @override
  void Function(LongPressEndDetails, LocalTranscriptionProvider?)
  get onLongPressEndHandler => onLongPressEnd;
  @override
  Future<void> Function(LocalTranscriptionProvider?)
  get handleStopLockedRecordingHandler => _handleStopLockedRecording;
  @override
  Future<void> Function(LocalTranscriptionProvider?)
  get handleStopRecordingHandler => handleStopRecording;

  @override
  void initState() {
    super.initState();
    _scaleController = AnimationController(
      duration: RecordingButtonConstants.scaleAnimationDuration,
      vsync: this,
    );
    _scaleAnimation =
        Tween<double>(
          begin: RecordingButtonConstants.scaleAnimationBegin,
          end: RecordingButtonConstants.scaleAnimationEnd,
        ).animate(
          CurvedAnimation(
            parent: _scaleController,
            curve: RecordingButtonConstants.scaleAnimationCurve,
          ),
        );

    _lockIndicatorController = AnimationController(
      duration: RecordingButtonConstants.lockIndicatorAnimationDuration,
      vsync: this,
    );
    _lockIndicatorAnimation =
        Tween<double>(
          begin: RecordingButtonConstants.lockIndicatorAnimationBegin,
          end: RecordingButtonConstants.lockIndicatorAnimationEnd,
        ).animate(
          CurvedAnimation(
            parent: _lockIndicatorController,
            curve: RecordingButtonConstants.lockIndicatorAnimationCurve,
          ),
        );

    _lockIndicatorAnimation.addListener(() {
      widget.onLockIndicatorProgressChanged?.call(
        _lockIndicatorAnimation.value,
      );
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && widget.isRecording) {
        setState(() {
          _isLongPressRecording = true;
          _isLocked = false;
          _dragOffsetY = 0.0;
        });
        widget.onLockIndicatorVisibilityChanged?.call(true);
        _lockIndicatorController.forward();
      }
    });
  }

  @override
  void didUpdateWidget(RecordingButton oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (widget.isRecording != oldWidget.isRecording) {
      if (widget.isRecording && !_isLongPressRecording) {
        setState(() {
          _isLongPressRecording = true;
          _isLocked = false;
          _dragOffsetY = 0.0;
        });
        widget.onLockIndicatorVisibilityChanged?.call(true);
        _lockIndicatorController.forward();
      } else if (!widget.isRecording && _isLongPressRecording) {
        setState(() {
          _isLongPressRecording = false;
          _isLocked = false;
          _dragOffsetY = 0.0;
        });
        widget.onLockIndicatorVisibilityChanged?.call(false);
        _lockIndicatorController.reverse();
      }
    }
  }

  @override
  void dispose() {
    _scaleController.dispose();
    _lockIndicatorController.dispose();
    _debounceTimer?.cancel();
    _gestureIsolationTimer?.cancel();
    _longPressTimer?.cancel();
    super.dispose();
  }

  Future<void> _handleStopLockedRecording(
    LocalTranscriptionProvider? provider,
  ) async {
    setState(() {
      _isLocked = false;
      _isLongPressRecording = false;
      _isPanning = false;
    });

    widget.onLockStateChanged?.call(false);

    widget.onLockIndicatorVisibilityChanged?.call(false);
    _lockIndicatorController.reverse();

    await handleStopRecording(provider);
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
              _scaleController.forward();
            } else {
              _scaleController.reverse();
            }
          }

          return buildButtonForState(state, colors, provider);
        },
      );
    } else {
      final state = widget.isRecording
          ? TranscriptionState.recording
          : TranscriptionState.ready;

      if (_lastKnownState != state) {
        _lastKnownState = state;
        if (state == TranscriptionState.recording) {
          _scaleController.forward();
        } else {
          _scaleController.reverse();
        }
      }

      return buildButtonForState(state, colors, null);
    }
  }
}
