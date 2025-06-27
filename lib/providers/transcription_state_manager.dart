import 'package:flutter/foundation.dart';

enum TranscriptionState { loading, ready, recording, transcribing, error }

class TranscriptionStateManager with ChangeNotifier {
  TranscriptionState _state = TranscriptionState.loading;
  String? _errorMessage;

  TranscriptionState get state => _state;
  bool get isLoading => _state == TranscriptionState.loading;
  bool get isModelReady => _state == TranscriptionState.ready;
  bool get isRecording => _state == TranscriptionState.recording;
  bool get isTranscribing => _state == TranscriptionState.transcribing;
  bool get isStreaming => _state == TranscriptionState.recording;
  String? get error =>
      _state == TranscriptionState.error ? _errorMessage : null;

  /// Validates if a state transition is allowed
  bool _validateStateTransition(
    TranscriptionState from,
    TranscriptionState to,
  ) {
    const validTransitions = {
      TranscriptionState.loading: {
        TranscriptionState.ready,
        TranscriptionState.error,
      },
      TranscriptionState.ready: {
        TranscriptionState.recording,
        TranscriptionState.loading,
        TranscriptionState.error,
      },
      TranscriptionState.recording: {
        TranscriptionState.transcribing,
        TranscriptionState.ready,
        TranscriptionState.error,
      },
      TranscriptionState.transcribing: {
        TranscriptionState.ready,
        TranscriptionState.error,
      },
      TranscriptionState.error: {
        TranscriptionState.loading,
        TranscriptionState.ready,
      },
    };

    return validTransitions[from]?.contains(to) ?? false;
  }

  /// Attempts to transition to a new state
  bool transitionTo(TranscriptionState newState, {String? errorMessage}) {
    if (!_validateStateTransition(_state, newState)) {
      return false;
    }

    _state = newState;

    if (newState == TranscriptionState.error) {
      _errorMessage = errorMessage ?? 'Unknown error occurred';
    } else {
      _errorMessage = null;
    }

    notifyListeners();
    return true;
  }

  /// Sets error state with message
  void setError(String message) {
    transitionTo(TranscriptionState.error, errorMessage: message);
  }

  /// Clears error state
  void clearError() {
    _errorMessage = null;
    if (_state == TranscriptionState.error) {
      transitionTo(TranscriptionState.ready);
    }
  }

  /// Resets to initial loading state
  void reset() {
    _state = TranscriptionState.loading;
    _errorMessage = null;
    notifyListeners();
  }
}
