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

  /// Horizontal padding for the controls
  final double horizontalPadding;

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
    this.horizontalPadding = 16.0,
    required this.colors,
  });

  @override
  Widget build(BuildContext context) {
    return Positioned(
      bottom: 16,
      left: 0,
      right: 0,
      child: Container(
        color: colors.glassBackground,
        child: _buildControlsForState(),
      ),
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
        AquaRecordingButton(
          state: RecordingButtonState.recording,
          onRecordingStart: onRecordingStart,
          onRecordingStop: onRecordingStop,
          enabled: enabled,
          colors: colors,
        ),
        SizedBox(height: spacing),
        SizedBox(
          height: 42,
          child: AquaAudioWaveVisualization(
            audioLevel: audioLevel,
            colors: colors,
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
        AquaRecordingButton(
          state: buttonState,
          onRecordingStart: onRecordingStart,
          onRecordingStop: onRecordingStop,
          enabled: enabled,
          colors: colors,
        ),
        SizedBox(height: spacing),
        SizedBox(
          height: 42,
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
            child: AquaStaticWaveBars(colors: colors),
          ),
        ),
      ],
    );
  }

  Widget _buildReadyLayout() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AquaRecordingButton(
          state: RecordingButtonState.ready,
          onRecordingStart: onRecordingStart,
          onRecordingStop: onRecordingStop,
          enabled: enabled,
          colors: colors,
        ),
        SizedBox(height: spacing),
        SizedBox(
          height: 42,
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
            child: AquaStaticWaveBars(colors: colors),
          ),
        ),
      ],
    );
  }
}
