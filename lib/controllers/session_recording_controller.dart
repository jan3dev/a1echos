import 'package:flutter/foundation.dart';
import 'dart:developer' as developer;
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

  /// Checks if any operation is currently in progress
  bool get isOperationInProgress =>
      _transcriptionProvider.isOperationInProgress;

  /// Checks if the system is ready for recording operations
  bool get isReadyForRecording =>
      _transcriptionProvider.isModelReady && !isOperationInProgress;

  /// Starts recording for the current session with enhanced validation
  Future<bool> startRecording() async {
    if (!isReadyForRecording) {
      developer.log(
        'Cannot start recording - system not ready. Model ready: ${_transcriptionProvider.isModelReady}, Operation in progress: $isOperationInProgress',
        name: 'SessionRecordingController',
      );
      return false;
    }

    try {
      developer.log(
        'Starting recording for session: $currentSessionId',
        name: 'SessionRecordingController',
      );

      final success = await _transcriptionProvider.startRecording();

      if (success) {
        developer.log(
          'Recording started successfully',
          name: 'SessionRecordingController',
        );
      } else {
        developer.log(
          'Failed to start recording',
          name: 'SessionRecordingController',
        );
      }

      return success;
    } catch (e, stackTrace) {
      developer.log(
        'Error starting recording: $e',
        name: 'SessionRecordingController',
        error: e,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Stops recording and saves the transcription with enhanced validation
  Future<void> stopRecordingAndSave() async {
    if (!isRecording && !isTranscribing) {
      developer.log(
        'Cannot stop recording - no active recording or transcription',
        name: 'SessionRecordingController',
      );
      return;
    }

    try {
      developer.log(
        'Stopping recording and saving transcription',
        name: 'SessionRecordingController',
      );

      await _transcriptionProvider.stopRecordingAndSave();

      developer.log(
        'Recording stopped and transcription saved successfully',
        name: 'SessionRecordingController',
      );
    } catch (e, stackTrace) {
      developer.log(
        'Error stopping recording: $e',
        name: 'SessionRecordingController',
        error: e,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  /// Gets the current active session ID
  String get currentSessionId => _sessionProvider.activeSessionId;

  /// Checks if there's an active recording or transcription in progress
  bool get hasActiveOperation => isRecording || isTranscribing;

  /// Gets a user-friendly status message
  String get statusMessage {
    if (isLoading) return 'Initializing...';
    if (isRecording) return 'Recording...';
    if (isTranscribing) return 'Processing transcription...';
    if (error != null) return 'Error: $error';
    if (isOperationInProgress) return 'System busy...';
    if (isReadyForRecording) return 'Ready to record';
    return 'Not ready';
  }

  /// Attempts to recover from error state
  Future<void> recoverFromError() async {
    if (error != null) {
      try {
        developer.log(
          'Attempting to recover from error state',
          name: 'SessionRecordingController',
        );

        if (error!.toLowerCase().contains('model not ready') ||
            error!.toLowerCase().contains('not initialized')) {
          await _transcriptionProvider.forceSystemReset();
        } else {
          await _transcriptionProvider.reinitializeModel();
        }

        developer.log(
          'Recovery attempt completed',
          name: 'SessionRecordingController',
        );
      } catch (e, stackTrace) {
        developer.log(
          'Error during recovery attempt: $e',
          name: 'SessionRecordingController',
          error: e,
          stackTrace: stackTrace,
        );
      }
    }
  }

  /// Forces a complete system reset to clear stuck states
  Future<void> forceSystemReset() async {
    try {
      developer.log(
        'Forcing complete system reset',
        name: 'SessionRecordingController',
      );

      await _transcriptionProvider.forceSystemReset();

      developer.log(
        'System reset completed successfully',
        name: 'SessionRecordingController',
      );
    } catch (e, stackTrace) {
      developer.log(
        'Error during system reset: $e',
        name: 'SessionRecordingController',
        error: e,
        stackTrace: stackTrace,
      );
    }
  }
}
