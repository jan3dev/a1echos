import 'dart:async';
import 'dart:convert';

import '../services/audio_service.dart';
import '../services/vosk_service.dart';
import '../services/whisper_service.dart';
import '../models/model_type.dart';
import '../logger.dart';

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
  bool _voskMonitorActive = false;

  final StreamController<String> _partialController =
      StreamController.broadcast();
  Stream<String> get onPartial => _partialController.stream;

  TranscriptionOrchestrator(
    this._audioService,
    this._voskService,
    this._whisperService,
  );

  /// Starts recording/streaming based on the selected model type.
  Future<bool> startRecording(
    ModelType type, {
    bool whisperRealtime = false,
    String? languageCode,
  }) async {
    return await _operationManager.executeSequentially(() async {
      if (_isRecording) {
        return false;
      }

      if (type == ModelType.vosk) {
        final service = _voskService.speechService;
        if (service == null) {
          return false;
        }

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
            logger.warning(
              'Failed to parse Vosk partial result: $e',
              flag: FeatureFlag.general,
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
            }
          } catch (e) {
            logger.warning(
              'Failed to parse Vosk final result: $e',
              flag: FeatureFlag.general,
            );
          }
        });

        await service.start();
        try {
          final ok = await _audioService.startMonitoring();
          _voskMonitorActive = ok;
        } catch (_) {
          _voskMonitorActive = false;
        }
        _isRecording = true;
        return true;
      } else {
        if (whisperRealtime && _whisperService != null) {
          await _partialSub?.cancel();
          _partialSub = _whisperService.onPartial.listen((p) {
            _partialController.add(p);
          });

          final success = await _whisperService.startRealtimeRecording(
            languageCode: languageCode,
          );
          if (success) {
            _isRecording = true;
          }
          return success;
        }

        try {
          final success = await _audioService.startRecording(
            useStreaming: false,
          );
          if (success) {
            _isRecording = true;
          }
          return success;
        } catch (e, st) {
          logger.error(
            e,
            stackTrace: st,
            flag: FeatureFlag.general,
            message: 'Failed to start audio service for Whisper',
          );
          return false;
        }
      }
    });
  }

  /// Stops recording/streaming and returns the transcription text and audio path.
  Future<TranscriptionOutput> stopRecording(
    ModelType type, {
    bool whisperRealtime = false,
    String? languageCode,
  }) async {
    return await _operationManager.executeSequentially(() async {
      if (!_isRecording) {
        return TranscriptionOutput(text: '', audioPath: '');
      }

      if (type == ModelType.vosk) {
        final service = _voskService.speechService;
        if (service == null) {
          _isRecording = false;
          if (_voskMonitorActive) {
            try {
              await _audioService.stopMonitoring();
            } catch (_) {}
            _voskMonitorActive = false;
          }
          return TranscriptionOutput(text: '', audioPath: '');
        }

        try {
          final completeText = await _voskService.stopGracefully();

          await _partialSub?.cancel();
          await _resultSub?.cancel();
          _partialSub = null;
          _resultSub = null;

          if (_voskMonitorActive) {
            try {
              await _audioService.stopMonitoring();
            } catch (_) {}
            _voskMonitorActive = false;
          }

          _isRecording = false;

          return TranscriptionOutput(text: completeText, audioPath: '');
        } catch (e, st) {
          await _partialSub?.cancel();
          logger.error(
            e,
            stackTrace: st,
            flag: FeatureFlag.general,
            message: 'Failed to stop Vosk gracefully',
          );
          await _resultSub?.cancel();
          _partialSub = null;
          _resultSub = null;
          _isRecording = false;

          if (_voskMonitorActive) {
            try {
              await _audioService.stopMonitoring();
            } catch (_) {}
            _voskMonitorActive = false;
          }

          return TranscriptionOutput(text: '', audioPath: '');
        }
      } else {
        if (_whisperService == null) {
          _isRecording = false;
          return TranscriptionOutput(text: '', audioPath: '');
        }

        if (whisperRealtime) {
          final text = await _whisperService.stopRealtimeRecording();
          _isRecording = false;
          await _partialSub?.cancel();
          _partialSub = null;
          return TranscriptionOutput(text: text, audioPath: '');
        }

        try {
          final audioFile = await _audioService.stopRecording();
          _isRecording = false;

          if (audioFile == null) {
            return TranscriptionOutput(text: '', audioPath: '');
          }

          final fileExists = await audioFile.exists();

          if (!fileExists) {
            return TranscriptionOutput(text: '', audioPath: '');
          }

          final fileSize = await audioFile.length();

          if (fileSize <= 44) {
            // WAV header is typically 44 bytes
            return TranscriptionOutput(text: '', audioPath: '');
          }

          if (!_whisperService.isInitialized) {
            final success = await _whisperService.initialize();
            if (!success) {
              return TranscriptionOutput(text: '', audioPath: '');
            }
          }

          final transcriptionText = await _whisperService.transcribeFile(
            audioFile.path,
            languageCode: languageCode,
          );

          final text = transcriptionText?.trim() ?? '';

          return TranscriptionOutput(text: text, audioPath: audioFile.path);
        } catch (e, st) {
          _isRecording = false;
          logger.error(
            e,
            stackTrace: st,
            flag: FeatureFlag.general,
            message: 'Failed to transcribe file with Whisper',
          );
          return TranscriptionOutput(text: '', audioPath: '');
        }
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
