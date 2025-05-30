import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;

import '../services/audio_service.dart';
import '../services/vosk_service.dart';
import '../services/whisper_service.dart';
import '../models/model_type.dart';

/// Output of a transcription stop operation, including text and audio path.
class TranscriptionOutput {
  final String text;
  final String audioPath;

  TranscriptionOutput({required this.text, required this.audioPath});
}

/// Manages sequential operations to prevent race conditions
class SequentialOperationManager {
  bool _isOperationInProgress = false;
  final List<Completer<void>> _operationQueue = [];

  /// Ensures only one operation runs at a time
  Future<T> executeSequentially<T>(Future<T> Function() operation) async {
    final completer = Completer<void>();
    _operationQueue.add(completer);

    while (_isOperationInProgress || _operationQueue.first != completer) {
      await Future.delayed(const Duration(milliseconds: 10));
    }

    _isOperationInProgress = true;
    _operationQueue.remove(completer);

    try {
      final result = await operation();
      return result;
    } finally {
      _isOperationInProgress = false;
      completer.complete();
    }
  }

  /// Checks if an operation is currently in progress
  bool get isOperationInProgress => _isOperationInProgress;
}

/// Orchestrates audio recording and real-time streaming (Vosk) or post-recording transcription (Whisper).
class TranscriptionOrchestrator {
  final AudioService _audioService;
  final VoskService _voskService;
  final WhisperService? _whisperService;
  final SequentialOperationManager _operationManager =
      SequentialOperationManager();

  StreamSubscription<String>? _partialSub;
  StreamSubscription<String>? _resultSub;
  bool _isRecording = false;

  // Streams partial transcription updates.
  final StreamController<String> _partialController =
      StreamController.broadcast();
  Stream<String> get onPartial => _partialController.stream;

  TranscriptionOrchestrator(
    this._audioService,
    this._voskService,
    this._whisperService,
  );

  /// Starts recording or streaming based on [type].
  Future<bool> startRecording(ModelType type) async {
    return await _operationManager.executeSequentially(() async {
      if (_isRecording) {
        developer.log('Recording already in progress', name: 'Orchestrator');
        return false;
      }

      if (type == ModelType.vosk) {
        final service = _voskService.speechService;
        if (service == null) throw Exception('Vosk service not available');

        _voskService.resultBuffer.clear();
        await _partialSub?.cancel();
        await _resultSub?.cancel();

        _partialSub = service.onPartial().listen((partialJson) {
          try {
            final data = jsonDecode(partialJson) as Map<String, dynamic>;
            final partial = data['partial'] as String? ?? '';
            if (partial.trim().isNotEmpty) {
              _voskService.resultBuffer.addPartial(partial);
              _partialController.add(
                _voskService.resultBuffer.getCompleteText(),
              );
            }
          } catch (e) {
            developer.log(
              'Error parsing Vosk partial: $e',
              name: 'Orchestrator',
            );
          }
        });

        _resultSub = service.onResult().listen((resultJson) {
          try {
            final data = jsonDecode(resultJson) as Map<String, dynamic>;
            final text = data['text'] as String? ?? '';
            if (text.trim().isNotEmpty) {
              _voskService.resultBuffer.addFinalResult(text);
              _partialController.add(
                _voskService.resultBuffer.getCompleteText(),
              );
              developer.log(
                'Vosk final result captured: "$text"',
                name: 'Orchestrator',
              );
            }
          } catch (e) {
            developer.log(
              'Error parsing Vosk result: $e',
              name: 'Orchestrator',
            );
          }
        });

        await service.start();
        _isRecording = true;
        developer.log(
          'Vosk recording started successfully',
          name: 'Orchestrator',
        );
        return true;
      } else {
        final success = await _audioService.startRecording(useStreaming: false);
        if (success) {
          _isRecording = true;
          developer.log(
            'Whisper recording started successfully',
            name: 'Orchestrator',
          );
        }
        return success;
      }
    });
  }

  /// Stops recording/streaming and returns the transcription text and audio path.
  Future<TranscriptionOutput> stopRecording(ModelType type) async {
    return await _operationManager.executeSequentially(() async {
      if (!_isRecording) {
        developer.log('No recording in progress to stop', name: 'Orchestrator');
        return TranscriptionOutput(text: '', audioPath: '');
      }

      if (type == ModelType.vosk) {
        final service = _voskService.speechService;
        if (service == null) throw Exception('Vosk service not available');

        developer.log(
          'Stopping Vosk recording gracefully...',
          name: 'Orchestrator',
        );

        final completeText = await _voskService.stopGracefully();

        await _partialSub?.cancel();
        await _resultSub?.cancel();
        _partialSub = null;
        _resultSub = null;

        _isRecording = false;

        developer.log(
          'Vosk recording stopped. Final text: "$completeText"',
          name: 'Orchestrator',
        );

        return TranscriptionOutput(text: completeText, audioPath: '');
      } else {
        if (_whisperService == null) {
          throw Exception('Whisper service not available');
        }

        final audioFile = await _audioService.stopRecording();
        _isRecording = false;

        if (audioFile == null || !await audioFile.exists()) {
          throw Exception('Recorded audio file not found');
        }

        final fileSize = await audioFile.length();
        if (fileSize < 1000) throw Exception('Recording too short or empty');

        final transcriptionText = await _whisperService.transcribeFile(
          audioFile.path,
        );
        final text = transcriptionText?.trim() ?? '';

        developer.log(
          'Whisper transcription completed: "$text"',
          name: 'Orchestrator',
        );

        return TranscriptionOutput(text: text, audioPath: audioFile.path);
      }
    });
  }

  /// Checks if currently recording
  bool get isRecording => _isRecording;

  /// Checks if an operation is in progress
  bool get isOperationInProgress => _operationManager.isOperationInProgress;

  Future<void> dispose() async {
    await _partialSub?.cancel();
    await _resultSub?.cancel();
    await _partialController.close();
    await _audioService.dispose();
    await _voskService.dispose();
    await _whisperService?.dispose();
    _isRecording = false;
  }
}
