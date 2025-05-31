import 'package:flutter/foundation.dart';
import '../providers/local_transcription_provider.dart';
import '../providers/session_provider.dart';

/// Controller for managing recording operations within a session
class SessionRecordingController with ChangeNotifier {
  final LocalTranscriptionProvider _transcriptionProvider;
  final SessionProvider _sessionProvider;

  SessionRecordingController({
    required LocalTranscriptionProvider transcriptionProvider,
    required SessionProvider sessionProvider,
  }) : _transcriptionProvider = transcriptionProvider,
       _sessionProvider = sessionProvider {
    _transcriptionProvider.addListener(_onTranscriptionStateChanged);
  }

  @override
  void dispose() {
    _transcriptionProvider.removeListener(_onTranscriptionStateChanged);
    super.dispose();
  }

  void _onTranscriptionStateChanged() {
    notifyListeners();
  }

  bool get isRecording => _transcriptionProvider.isRecording;
  bool get isTranscribing => _transcriptionProvider.isTranscribing;
  bool get isLoading => _transcriptionProvider.isLoading;
  String? get error => _transcriptionProvider.error;

  /// Starts recording for the current session
  Future<void> startRecording() async {
    try {
      await _transcriptionProvider.startRecording();
    } catch (e) {
      debugPrint('Error starting recording: $e');
      rethrow;
    }
  }

  /// Stops recording and saves the transcription
  Future<void> stopRecordingAndSave() async {
    if (!isRecording && !isTranscribing) return;

    try {
      await _transcriptionProvider.stopRecordingAndSave();
    } catch (e) {
      debugPrint('Error stopping recording: $e');
      rethrow;
    }
  }

  /// Gets the current active session ID
  String get currentSessionId => _sessionProvider.activeSessionId;

  /// Checks if there's an active recording or transcription in progress
  bool get hasActiveOperation => isRecording || isTranscribing;
}
