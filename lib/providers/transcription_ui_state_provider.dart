import 'package:flutter/foundation.dart';
import 'dart:developer' as developer;
import '../models/transcription.dart';
import '../models/model_type.dart';

class TranscriptionUIStateProvider with ChangeNotifier {
  String _currentStreamingText = '';
  Transcription? _liveVoskTranscriptionPreview;
  Transcription? _loadingWhisperTranscriptionPreview;
  String? _recordingSessionId;

  String get currentStreamingText => _currentStreamingText;
  Transcription? get liveVoskTranscriptionPreview =>
      _liveVoskTranscriptionPreview;
  Transcription? get loadingWhisperTranscriptionPreview =>
      _loadingWhisperTranscriptionPreview;
  String? get recordingSessionId => _recordingSessionId;

  /// Gets live Vosk preview only if it belongs to the specified session
  Transcription? getLiveVoskTranscriptionPreviewForSession(String? sessionId) {
    if (_liveVoskTranscriptionPreview?.sessionId == sessionId) {
      return _liveVoskTranscriptionPreview;
    }
    return null;
  }

  /// Gets Whisper loading preview only if it belongs to the specified session
  Transcription? getLoadingWhisperTranscriptionPreviewForSession(
    String? sessionId,
  ) {
    if (_loadingWhisperTranscriptionPreview?.sessionId == sessionId) {
      return _loadingWhisperTranscriptionPreview;
    }
    return null;
  }

  /// Updates the streaming text during live transcription
  void updateStreamingText(String text) {
    _currentStreamingText = text;
    developer.log(
      'Streaming text updated: ${text.length} characters',
      name: 'TranscriptionUIStateProvider',
    );
    notifyListeners();
  }

  /// Clears the streaming text
  void clearStreamingText() {
    _currentStreamingText = '';
    notifyListeners();
  }

  /// Sets the recording session ID when recording starts
  void setRecordingSessionId(String sessionId) {
    _recordingSessionId = sessionId;
    developer.log(
      'Recording session ID set: $sessionId',
      name: 'TranscriptionUIStateProvider',
    );
  }

  /// Clears the recording session ID when recording stops
  void clearRecordingSessionId() {
    _recordingSessionId = null;
    developer.log(
      'Recording session ID cleared',
      name: 'TranscriptionUIStateProvider',
    );
  }

  /// Creates or updates live Vosk transcription preview
  void updateLiveVoskPreview(String text, String sessionId) {
    _liveVoskTranscriptionPreview = Transcription(
      id: 'live_vosk_active_preview',
      text: text,
      timestamp: DateTime.now(),
      sessionId: sessionId,
      audioPath: '',
    );

    developer.log(
      'Live Vosk preview updated for session: $sessionId',
      name: 'TranscriptionUIStateProvider',
    );
    notifyListeners();
  }

  /// Clears live Vosk transcription preview
  void clearLiveVoskPreview() {
    if (_liveVoskTranscriptionPreview != null) {
      developer.log(
        'Clearing live Vosk preview',
        name: 'TranscriptionUIStateProvider',
      );
      _liveVoskTranscriptionPreview = null;
      notifyListeners();
    }
  }

  /// Creates Whisper loading preview
  void createWhisperLoadingPreview(String sessionId) {
    _loadingWhisperTranscriptionPreview = Transcription(
      id: 'whisper_loading_active_preview',
      text: '',
      timestamp: DateTime.now(),
      sessionId: sessionId,
      audioPath: '',
    );

    developer.log(
      'Whisper loading preview created for session: $sessionId',
      name: 'TranscriptionUIStateProvider',
    );
    notifyListeners();
  }

  /// Clears Whisper loading preview
  void clearWhisperLoadingPreview() {
    if (_loadingWhisperTranscriptionPreview != null) {
      developer.log(
        'Clearing Whisper loading preview',
        name: 'TranscriptionUIStateProvider',
      );
      _loadingWhisperTranscriptionPreview = null;
      notifyListeners();
    }
  }

  /// Clears previews that don't belong to the current session
  void cleanupPreviewsForSessionChange(String? currentSessionId) {
    bool changed = false;

    if (_liveVoskTranscriptionPreview?.sessionId != currentSessionId) {
      developer.log(
        'Clearing live Vosk preview (session: ${_liveVoskTranscriptionPreview?.sessionId}, current: $currentSessionId)',
        name: 'TranscriptionUIStateProvider',
      );
      _liveVoskTranscriptionPreview = null;
      changed = true;
    }

    if (_loadingWhisperTranscriptionPreview?.sessionId != currentSessionId) {
      developer.log(
        'Clearing Whisper loading preview (session: ${_loadingWhisperTranscriptionPreview?.sessionId}, current: $currentSessionId)',
        name: 'TranscriptionUIStateProvider',
      );
      _loadingWhisperTranscriptionPreview = null;
      changed = true;
    }

    if (changed) {
      notifyListeners();
    }
  }

  /// Updates preview based on recording state and model type
  void updatePreviewForRecording(
    ModelType modelType,
    String text,
    String sessionId,
    bool isRecording,
  ) {
    if (modelType == ModelType.vosk && isRecording) {
      updateLiveVoskPreview(text, sessionId);
      clearWhisperLoadingPreview();
    } else if (modelType == ModelType.whisper) {
      clearLiveVoskPreview();
    } else {
      clearLiveVoskPreview();
    }
  }

  /// Resets all UI state
  void reset() {
    _currentStreamingText = '';
    _liveVoskTranscriptionPreview = null;
    _loadingWhisperTranscriptionPreview = null;
    _recordingSessionId = null;
    notifyListeners();
  }
}
