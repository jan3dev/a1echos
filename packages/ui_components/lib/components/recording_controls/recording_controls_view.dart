import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';

/// Enum representing the different states of the recording controls
enum RecordingControlsState {
  /// Ready to start recording
  ready,

  /// Currently recording
  recording,

  /// Transcribing the recording
  transcribing,

  /// Loading or error state
  loading,
}

/// Recording controls component that manages the bottom recording area
class AquaRecordingControlsView extends StatelessWidget {
  /// Current state of the recording controls
  final RecordingControlsState state;

  /// Callback when recording should start
  final VoidCallback? onRecordingStart;

  /// Callback when recording should stop
  final VoidCallback? onRecordingStop;

  /// Current audio level (0.0 to 1.0) for wave visualization
  final double audioLevel;

  /// Whether the controls are enabled
  final bool enabled;

  /// Spacing between elements
  final double spacing;

  /// Theme colors for the component
  final AquaColors colors;

  const AquaRecordingControlsView({
    super.key,
    this.state = RecordingControlsState.ready,
    this.onRecordingStart,
    this.onRecordingStop,
    this.audioLevel = 0.0,
    this.enabled = true,
    this.spacing = 16.0,
    required this.colors,
  });

  @override
  Widget build(BuildContext context) {
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Stack(
        children: [
          IgnorePointer(
            child: ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                child: CustomPaint(
                  foregroundPainter: const _FadeMaskPainter(fadeHeight: 32.0),
                  child: Container(
                    height: _getControlsHeight(),
                    decoration: BoxDecoration(
                      color: colors.glassBackground,
                    ),
                  ),
                ),
              ),
            ),
          ),
          _buildControlsForState(),
        ],
      ),
    );
  }

  /// Calculate the height of the controls based on the current state
  /// Button height (64) + padding (16 top + 16 bottom) = 96
  double _getControlsHeight() => 96.0;

  Widget _buildControlsForState() {
    switch (state) {
      case RecordingControlsState.recording:
        return _buildRecordingLayout();
      case RecordingControlsState.transcribing:
      case RecordingControlsState.loading:
        return _buildTranscribingLayout();
      case RecordingControlsState.ready:
        return _buildReadyLayout();
    }
  }

  Widget _buildRecordingLayout() {
    return Padding(
      padding: const EdgeInsets.symmetric(
        vertical: 16.0,
      ),
      child: SizedBox(
        height: 64,
        child: Stack(
          alignment: Alignment.topCenter,
          children: [
            Positioned(
              left: 0,
              right: 0,
              top: 11,
              child: SizedBox(
                height: 42,
                child: AquaThreeWaveLines(
                  audioLevel: audioLevel,
                  colors: colors,
                  state: RecordingControlsState.recording,
                ),
              ),
            ),
            Positioned(
              top: 0,
              child: AquaRecordingButton(
                state: RecordingButtonState.recording,
                onRecordingStart: onRecordingStart,
                onRecordingStop: onRecordingStop,
                enabled: enabled,
                colors: colors,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTranscribingLayout() {
    final buttonState = state == RecordingControlsState.transcribing
        ? RecordingButtonState.transcribing
        : RecordingButtonState.loading;

    return Padding(
      padding: const EdgeInsets.symmetric(
        vertical: 16.0,
      ),
      child: SizedBox(
        height: 64,
        child: Stack(
          alignment: Alignment.topCenter,
          children: [
            Positioned(
              left: 0,
              right: 0,
              top: 11,
              child: SizedBox(
                height: 42,
                child: AquaThreeWaveLines(
                  audioLevel: audioLevel,
                  colors: colors,
                  state: state,
                ),
              ),
            ),
            Positioned(
              top: 0,
              child: AquaRecordingButton(
                state: buttonState,
                onRecordingStart: onRecordingStart,
                onRecordingStop: onRecordingStop,
                enabled: enabled,
                colors: colors,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReadyLayout() {
    return Padding(
      padding: const EdgeInsets.symmetric(
        vertical: 16.0,
      ),
      child: SizedBox(
        height: 64,
        child: Stack(
          alignment: Alignment.topCenter,
          children: [
            Positioned(
              left: 0,
              right: 0,
              top: 11,
              child: SizedBox(
                height: 42,
                child: AquaThreeWaveLines(
                  audioLevel: audioLevel,
                  colors: colors,
                  state: RecordingControlsState.ready,
                ),
              ),
            ),
            Positioned(
              top: 0,
              child: AquaRecordingButton(
                state: RecordingButtonState.ready,
                onRecordingStart: onRecordingStart,
                onRecordingStop: onRecordingStop,
                enabled: enabled,
                colors: colors,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FadeMaskPainter extends CustomPainter {
  const _FadeMaskPainter({required this.fadeHeight});

  final double fadeHeight;

  @override
  void paint(Canvas canvas, Size size) {
    final fadeStop = (fadeHeight / size.height).clamp(0.0, 1.0);
    final paint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: const [
          Colors.transparent,
          Colors.white,
          Colors.white,
        ],
        stops: [0.0, fadeStop, 1.0],
      ).createShader(Offset.zero & size)
      ..blendMode = BlendMode.dstIn;

    canvas.drawRect(Offset.zero & size, paint);
  }

  @override
  bool shouldRepaint(covariant _FadeMaskPainter oldDelegate) {
    return oldDelegate.fadeHeight != fadeHeight;
  }
}
