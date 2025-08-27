import 'dart:async';
import 'package:flutter/material.dart';
import '../../logger.dart';
import '../../providers/local_transcription_provider.dart';
import 'recording_button_constants.dart';

/// Mixin that handles all recording action logic for the RecordingButton
/// Manages recording start/stop, debouncing, and validation
mixin RecordingButtonActionHandler<T extends StatefulWidget> on State<T> {
  bool get isDebouncing;
  bool get gestureIsolationActive;
  Timer? get debounceTimer;
  Timer? get gestureIsolationTimer;
  DateTime? get lastActionTime;
  String? get lastActionType;

  set isDebouncing(bool value);
  set gestureIsolationActive(bool value);
  set debounceTimer(Timer? value);
  set gestureIsolationTimer(Timer? value);
  set lastActionTime(DateTime? value);
  set lastActionType(String? value);

  VoidCallback? get onRecordingStart;
  VoidCallback? get onRecordingStop;

  /// Handles recording actions with enhanced debouncing and validation
  Future<void> handleRecordingAction(
    Future<void> Function() action,
    String actionName,
  ) async {
    if (gestureIsolationActive) {
      return;
    }

    if (isDebouncing && lastActionType == actionName) {
      return;
    }

    final now = DateTime.now();
    if (lastActionTime != null) {
      final timeSinceLastAction = now.difference(lastActionTime!);
      if (timeSinceLastAction <
          RecordingButtonConstants.minimumActionInterval) {
        return;
      }
    }

    if (!mounted) return;

    setState(() {
      isDebouncing = true;
      lastActionType = actionName;
      gestureIsolationActive = true;
    });
    lastActionTime = now;

    try {
      await action();

      debounceTimer?.cancel();
      debounceTimer = Timer(RecordingButtonConstants.debounceDuration, () {
        if (mounted) {
          setState(() => isDebouncing = false);
        }
      });

      gestureIsolationTimer?.cancel();
      gestureIsolationTimer = Timer(
        RecordingButtonConstants.gestureIsolationDuration,
        () {
          if (mounted) {
            setState(() => gestureIsolationActive = false);
          }
        },
      );
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.ui,
        message: 'Error handling recording action: $actionName',
      );
    } finally {
      gestureIsolationTimer?.cancel();
      gestureIsolationTimer = Timer(
        RecordingButtonConstants.gestureIsolationDuration,
        () {
          if (mounted) {
            setState(() => gestureIsolationActive = false);
          }
        },
      );
    }
  }

  /// Handles start recording action with validation
  Future<void> handleStartRecording(
    LocalTranscriptionProvider? provider,
  ) async {
    await handleRecordingAction(() async {
      if (onRecordingStart != null) {
        onRecordingStart!();
      } else if (provider != null) {
        final success = await provider.startRecording();
        if (!success) {
          throw Exception('Failed to start recording - system may be busy');
        }
      }
    }, 'Start Recording');
  }

  /// Handles stop recording action with validation
  Future<void> handleStopRecording(LocalTranscriptionProvider? provider) async {
    await handleRecordingAction(() async {
      if (onRecordingStop != null) {
        onRecordingStop!();
      } else if (provider != null) {
        await provider.stopRecordingAndSave();
      }
    }, 'Stop Recording');
  }
}
