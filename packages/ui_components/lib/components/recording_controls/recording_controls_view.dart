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
      child: IgnorePointer(
        ignoring: false,
        child: Stack(
          children: [
            Positioned.fill(
              child: IgnorePointer(
                child: Container(
                  height: _getControlsHeight(),
                  decoration: BoxDecoration(
                    color: colors.glassBackground,
                  ),
                ),
              ),
            ),
            _buildControlsForState(),
          ],
        ),
      ),
    );
  }

  /// Calculate the height of the controls based on the current state
  double _getControlsHeight() {
    switch (state) {
      case RecordingControlsState.recording:
      case RecordingControlsState.transcribing:
      case RecordingControlsState.loading:
      case RecordingControlsState.ready:
        // Button height (64) + spacing (16) + wave height (42) + padding (16 top + 16 bottom) = 154
        return 154.0;
    }
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
    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: horizontalPadding,
        vertical: 16.0,
      ),
      child: Column(
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
      ),
    );
  }

  Widget _buildTranscribingLayout() {
    final buttonState = state == RecordingControlsState.transcribing
        ? RecordingButtonState.transcribing
        : RecordingButtonState.loading;

    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: horizontalPadding,
        vertical: 16.0,
      ),
      child: Column(
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
            child: AquaStaticWaveBars(colors: colors),
          ),
        ],
      ),
    );
  }

  Widget _buildReadyLayout() {
    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: horizontalPadding,
        vertical: 16.0,
      ),
      child: Column(
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
            child: AquaStaticWaveBars(colors: colors),
          ),
        ],
      ),
    );
  }
}
