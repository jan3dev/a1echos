import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:ui_components/ui_components.dart';

import '../providers/local_transcription_provider.dart';
import '../constants/app_constants.dart';
import '../providers/transcription_state_manager.dart';

class RecordingButton extends StatefulWidget {
  /// Callback that gets triggered when recording is started
  final VoidCallback? onRecordingStart;

  /// Callback that gets triggered when recording is stopped
  final VoidCallback? onRecordingStop;

  /// Whether the button should show in recording state
  final bool isRecording;

  /// Whether to use the provider for state or rely on passed parameters
  final bool useProviderState;

  const RecordingButton({
    super.key,
    this.onRecordingStart,
    this.onRecordingStop,
    this.isRecording = false,
    this.useProviderState = true,
  });

  @override
  State<RecordingButton> createState() => _RecordingButtonState();
}

class _RecordingButtonState extends State<RecordingButton> {
  bool _isDebouncing = false;
  bool _gestureIsolationActive = false;
  Timer? _debounceTimer;
  Timer? _gestureIsolationTimer;
  DateTime? _lastActionTime;
  String? _lastActionType;
  TranscriptionState? _lastKnownState;

  static const Duration _debounceDuration = Duration(milliseconds: 800);
  static const Duration _minimumActionInterval = Duration(milliseconds: 1200);
  static const Duration _gestureIsolationDuration = Duration(
    milliseconds: 2000,
  );

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _gestureIsolationTimer?.cancel();
    super.dispose();
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
    } catch (e) {
      if (mounted) {
        setState(() {
          _isDebouncing = false;
          _gestureIsolationActive = false;
        });
        _showActionErrorDialog(context, actionName, e.toString());
      }
    }
  }

  /// Handles start recording action with validation
  Future<void> _handleStartRecording(
    LocalTranscriptionProvider? provider,
  ) async {
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

  /// Handles stop recording action with validation
  Future<void> _handleStopRecording(
    LocalTranscriptionProvider? provider,
  ) async {
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
    final colors = AquaColors.lightColors;

    if (widget.useProviderState) {
      return Consumer<LocalTranscriptionProvider>(
        builder: (context, provider, child) {
          final state = provider.state;

          if (_lastKnownState != state) {
            _lastKnownState = state;
            if (state == TranscriptionState.ready ||
                state == TranscriptionState.error) {
              _gestureIsolationActive = false;
            }
          }

          return _buildButtonForState(state, colors, provider);
        },
      );
    } else {
      final state = widget.isRecording
          ? TranscriptionState.recording
          : TranscriptionState.ready;
      return _buildButtonForState(state, colors, null);
    }
  }

  Widget _buildButtonForState(
    TranscriptionState state,
    AquaColors colors,
    LocalTranscriptionProvider? provider,
  ) {
    switch (state) {
      case TranscriptionState.loading:
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
      case TranscriptionState.error:
        return Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            color: colors.accentDanger,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: colors.surfaceInverse.withOpacity(0.04),
                blurRadius: 16,
                offset: const Offset(0, 0),
              ),
            ],
          ),
          child: IconButton(
            onPressed: (_isDebouncing || _gestureIsolationActive)
                ? null
                : () {
                    if (provider != null) {
                      _showModelErrorDialog(context, provider.error);
                    }
                  },
            icon: Icon(Icons.error_outline, color: colors.textInverse),
          ),
        );
      case TranscriptionState.recording:
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

  void _showModelErrorDialog(BuildContext context, String? errorMessage) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(AppStrings.modelNotReady),
        content: Text(errorMessage ?? AppStrings.modelInitFailure),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(AppStrings.ok),
          ),
        ],
      ),
    );
  }

  void _showActionErrorDialog(
    BuildContext context,
    String action,
    String error,
  ) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('$action Failed'),
        content: Text(
          'An error occurred: $error\n\nPlease try again in a moment.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(AppStrings.ok),
          ),
        ],
      ),
    );
  }
}
