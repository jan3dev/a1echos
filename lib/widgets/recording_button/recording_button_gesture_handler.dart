import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../providers/local_transcription_provider.dart';
import 'recording_button_constants.dart';

/// Mixin that handles all gesture-related logic for the RecordingButton
/// Manages long press, drag, and lock functionality
mixin RecordingButtonGestureHandler<T extends StatefulWidget> on State<T> {
  bool get isLongPressing;
  bool get isLongPressRecording;
  bool get isPanning;
  bool get isLocked;
  double get panStartY;
  double get currentPanY;
  double get dragOffsetY;
  Timer? get longPressTimer;

  AnimationController get lockIndicatorController;

  VoidCallback? get onRecordingStart;
  VoidCallback? get onRecordingStop;
  ValueChanged<bool>? get onLockIndicatorVisibilityChanged;
  ValueChanged<double>? get onLockIndicatorProgressChanged;
  ValueChanged<bool>? get onLockStateChanged;

  set isLongPressing(bool value);
  set isLongPressRecording(bool value);
  set isPanning(bool value);
  set isLocked(bool value);
  set panStartY(double value);
  set currentPanY(double value);
  set dragOffsetY(double value);

  Future<void> handleStartRecording(LocalTranscriptionProvider? provider);
  Future<void> handleStopRecording(LocalTranscriptionProvider? provider);

  /// Handles long press start - starts recording immediately (like Telegram)
  void onLongPressStart(
    LongPressStartDetails details,
    LocalTranscriptionProvider? provider,
  ) {
    HapticFeedback.mediumImpact();

    setState(() {
      isLongPressing = true;
      isLongPressRecording = true;
      isLocked = false;
      dragOffsetY = 0.0;
      isPanning = true;
      panStartY = details.globalPosition.dy;
      currentPanY = details.globalPosition.dy;
    });

    onLockIndicatorVisibilityChanged?.call(true);
    lockIndicatorController.forward();

    handleStartRecording(provider);
  }

  /// Handles long press move update - for swipe to lock during recording (like Telegram)
  void onLongPressMoveUpdate(LongPressMoveUpdateDetails details) {
    if (!isLongPressRecording || !mounted) return;

    setState(() {
      currentPanY = details.globalPosition.dy;
    });

    if (panStartY <= 0 || currentPanY <= 0) {
      return;
    }

    final slideDistance = panStartY - currentPanY;

    if (slideDistance <= 0) {
      return;
    }

    final progress = (slideDistance / RecordingButtonConstants.lockThreshold)
        .clamp(0.0, 1.0);

    dragOffsetY = -slideDistance.clamp(
      0.0,
      RecordingButtonConstants.lockThreshold,
    );

    onLockIndicatorProgressChanged?.call(progress);

    if (slideDistance > RecordingButtonConstants.lockThreshold &&
        slideDistance < (RecordingButtonConstants.lockThreshold * 2) &&
        !isLocked &&
        progress >= 1.0) {
      HapticFeedback.heavyImpact();
      activateLock();
    } else if (slideDistance > (RecordingButtonConstants.lockThreshold * 2)) {}
  }

  /// Handles long press end - stops recording unless locked
  void onLongPressEnd(
    LongPressEndDetails details,
    LocalTranscriptionProvider? provider,
  ) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        setState(() {
          isPanning = false;
          dragOffsetY = 0.0;
        });
      }
    });

    if (isLongPressRecording && !isLocked) {
      handleStopRecording(provider);

      onLockIndicatorVisibilityChanged?.call(false);
      lockIndicatorController.reverse();

      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          setState(() {
            isLongPressing = false;
            isLongPressRecording = false;
            isLocked = false;
            dragOffsetY = 0.0;
          });
        }
      });
    } else if (!isLongPressRecording) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          setState(() {
            isLongPressing = false;
          });
        }
      });
    }
  }

  /// Activates the lock state
  void activateLock() {
    if (isLocked) return;

    setState(() {
      isLocked = true;
    });

    onLockStateChanged?.call(true);
    onLockIndicatorProgressChanged?.call(1.0);
  }
}
