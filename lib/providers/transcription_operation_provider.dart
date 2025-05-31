import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import 'dart:developer' as developer;
import 'dart:async';
import 'dart:io';
import '../models/transcription.dart';
import '../models/model_type.dart';
import '../repositories/transcription_repository.dart';
import '../utils/transcription_formatter.dart';
import '../managers/transcription_orchestrator.dart';
import 'session_provider.dart';

class TranscriptionOperationProvider with ChangeNotifier {
  final TranscriptionRepository _repository = TranscriptionRepository();
  final Uuid _uuid = const Uuid();
  final SessionProvider _sessionProvider;

  late TranscriptionOrchestrator _orchestrator;
  StreamSubscription<String>? _partialSubscription;

  TranscriptionOperationProvider(this._sessionProvider);

  /// Initializes the orchestrator and sets up partial text listening
  void initializeOrchestrator(TranscriptionOrchestrator orchestrator) {
    _orchestrator = orchestrator;

    _partialSubscription?.cancel();
    _partialSubscription = _orchestrator.onPartial.listen((partial) {
      _onPartialTranscription?.call(partial);
    });
  }

  /// Callback for partial transcription updates
  void Function(String)? _onPartialTranscription;

  /// Sets the callback for partial transcription updates
  void setPartialTranscriptionCallback(void Function(String) callback) {
    _onPartialTranscription = callback;
  }

  /// Starts recording with the specified model type
  Future<bool> startRecording(ModelType modelType, String sessionId) async {
    try {
      developer.log(
        'Starting ${modelType.name} recording for session: $sessionId',
        name: 'TranscriptionOperationProvider',
      );

      final success = await _orchestrator.startRecording(modelType);

      if (success) {
        developer.log(
          'Recording started successfully',
          name: 'TranscriptionOperationProvider',
        );
      } else {
        final errorMessage =
            modelType == ModelType.whisper
                ? 'Failed to start audio recording for Whisper'
                : 'Failed to start Vosk streaming';
        developer.log(errorMessage, name: 'TranscriptionOperationProvider');
      }

      return success;
    } catch (e, stack) {
      developer.log(
        'Failed to start recording: $e',
        name: 'TranscriptionOperationProvider',
        error: e,
        stackTrace: stack,
      );
      return false;
    }
  }

  /// Stops recording and returns the transcription result
  Future<TranscriptionResult> stopRecordingAndTranscribe(
    ModelType modelType,
    String sessionId,
  ) async {
    try {
      developer.log(
        'Stopping ${modelType.name} recording...',
        name: 'TranscriptionOperationProvider',
      );

      final output = await _orchestrator.stopRecording(modelType);
      final resultText = output.text.trim();

      developer.log(
        'Recording stopped. Result text length: ${resultText.length}',
        name: 'TranscriptionOperationProvider',
      );

      if (resultText.isEmpty) {
        final modelName = modelType == ModelType.vosk ? 'Vosk' : 'Whisper';
        return TranscriptionResult.error('No speech detected ($modelName)');
      }

      String audioPath = '';
      if (modelType == ModelType.whisper) {
        final tempFile = File(output.audioPath);
        if (await tempFile.exists()) {
          audioPath = await _repository.saveAudioFile(
            tempFile,
            'whisper_${_uuid.v4()}.m4a',
          );
          try {
            await tempFile.delete();
          } catch (_) {}
        }
      }

      final transcription = await _saveTranscription(
        resultText,
        audioPath,
        sessionId,
      );

      return TranscriptionResult.success(transcription);
    } catch (e, stack) {
      final errorMessage = 'Error stopping/saving transcription: $e';
      developer.log(
        errorMessage,
        name: 'TranscriptionOperationProvider',
        error: e,
        stackTrace: stack,
      );
      return TranscriptionResult.error(errorMessage);
    }
  }

  /// Saves a transcription to the repository
  Future<Transcription> _saveTranscription(
    String text,
    String audioPath,
    String sessionId,
  ) async {
    developer.log(
      'Saving transcription to session: $sessionId',
      name: 'TranscriptionOperationProvider',
    );

    final formattedText = TranscriptionFormatter.format(text);
    final transcription = Transcription(
      id: _uuid.v4(),
      sessionId: sessionId,
      text: formattedText,
      timestamp: DateTime.now(),
      audioPath: audioPath,
    );

    await _repository.saveTranscription(transcription);
    await _sessionProvider.updateSessionModifiedTimestamp(sessionId);

    developer.log(
      'Transcription saved successfully: ${transcription.id}',
      name: 'TranscriptionOperationProvider',
    );

    return transcription;
  }

  /// Checks if the orchestrator is busy with an operation
  bool get isOperationInProgress => _orchestrator.isOperationInProgress;

  /// Checks if currently recording
  bool get isRecording => _orchestrator.isRecording;

  @override
  void dispose() {
    _partialSubscription?.cancel();
    super.dispose();
  }
}

/// Result of a transcription operation
class TranscriptionResult {
  final bool isSuccess;
  final Transcription? transcription;
  final String? errorMessage;

  TranscriptionResult._({
    required this.isSuccess,
    this.transcription,
    this.errorMessage,
  });

  factory TranscriptionResult.success(Transcription transcription) {
    return TranscriptionResult._(isSuccess: true, transcription: transcription);
  }

  factory TranscriptionResult.error(String message) {
    return TranscriptionResult._(isSuccess: false, errorMessage: message);
  }
}
