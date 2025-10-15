import 'package:ui_components/ui_components.dart';
import '../providers/transcription_state_manager.dart';

/// Utility functions for mapping between different state representations
class StateMappingUtils {
  /// Maps TranscriptionState to RecordingControlsState for the design system
  static RecordingControlsState mapTranscriptionStateToRecordingControlsState(
    TranscriptionState state,
  ) {
    switch (state) {
      case TranscriptionState.ready:
      case TranscriptionState.error:
        return RecordingControlsState.ready;
      case TranscriptionState.recording:
        return RecordingControlsState.recording;
      case TranscriptionState.transcribing:
        return RecordingControlsState.transcribing;
      case TranscriptionState.loading:
        return RecordingControlsState.loading;
    }
  }
}
