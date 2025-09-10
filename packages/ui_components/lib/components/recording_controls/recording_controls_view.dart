import 'package:flutter/material.dart';
import 'recording_button.dart';
import 'audio_wave_visualization.dart';
import 'static_wave_bars.dart';

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

  /// Horizontal padding for the controls
  final double horizontalPadding;

  const AquaRecordingControlsView({
    super.key,
    this.state = RecordingControlsState.ready,
    this.onRecordingStart,
    this.onRecordingStop,
    this.audioLevel = 0.0,
    this.enabled = true,
    this.spacing = 16.0,
    this.horizontalPadding = 16.0,
  });

  @override
  Widget build(BuildContext context) {
    return Positioned(
      bottom: 16,
      left: 0,
      right: 0,
      child: _buildControlsForState(),
    );
  }

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
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
          child: AquaRecordingButton(
            state: RecordingButtonState.recording,
            onRecordingStart: onRecordingStart,
            onRecordingStop: onRecordingStop,
            enabled: enabled,
          ),
        ),
        SizedBox(height: spacing),
        SizedBox(
          height: 64,
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
            child: AquaAudioWaveVisualization(
              audioLevel: audioLevel,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTranscribingLayout() {
    final buttonState = state == RecordingControlsState.transcribing
        ? RecordingButtonState.transcribing
        : RecordingButtonState.loading;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
          child: AquaRecordingButton(
            state: buttonState,
            onRecordingStart: onRecordingStart,
            onRecordingStop: onRecordingStop,
            enabled: enabled,
          ),
        ),
        SizedBox(height: spacing),
        SizedBox(
          height: 64,
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
            child: const AquaStaticWaveBars(),
          ),
        ),
      ],
    );
  }

  Widget _buildReadyLayout() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
          child: AquaRecordingButton(
            state: RecordingButtonState.ready,
            onRecordingStart: onRecordingStart,
            onRecordingStop: onRecordingStop,
            enabled: enabled,
          ),
        ),
        const SizedBox(height: 42),
        Padding(
          padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
          child: const AquaStaticWaveBars(),
        ),
        const SizedBox(height: 26),
      ],
    );
  }
}
