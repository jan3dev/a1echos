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

/// Orchestrates audio recording and real-time streaming (Vosk) or post-recording transcription (Whisper).
class TranscriptionOrchestrator {
  final AudioService _audioService;
  final VoskService _voskService;
  final WhisperService? _whisperService;

  String _accumulatedText = '';
  StreamSubscription<String>? _partialSub;
  StreamSubscription<String>? _resultSub;

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
    if (type == ModelType.vosk) {
      final service = _voskService.speechService;
      if (service == null) throw Exception('Vosk service not available');
      _accumulatedText = '';
      await _partialSub?.cancel();
      await _resultSub?.cancel();

      _partialSub = service.onPartial().listen((partialJson) {
        try {
          final data = jsonDecode(partialJson) as Map<String, dynamic>;
          final partial = data['partial'] as String? ?? '';
          if (partial.trim().isEmpty && _accumulatedText.isNotEmpty) return;
          final output =
              _accumulatedText.isEmpty ? partial : '$_accumulatedText $partial';
          _partialController.add(output);
        } catch (e) {
          developer.log('Error parsing Vosk partial: $e', name: 'Orchestrator');
        }
      });

      _resultSub = service.onResult().listen((resultJson) {
        try {
          final data = jsonDecode(resultJson) as Map<String, dynamic>;
          final text = data['text'] as String? ?? '';
          if (text.trim().isNotEmpty) {
            _accumulatedText =
                _accumulatedText.isEmpty ? text : '$_accumulatedText $text';
            _partialController.add(_accumulatedText);
          }
        } catch (e) {
          developer.log('Error parsing Vosk result: $e', name: 'Orchestrator');
        }
      });

      await service.start();
      return true;
    } else {
      return await _audioService.startRecording(useStreaming: false);
    }
  }

  /// Stops recording/streaming and returns the transcription text and audio path.
  Future<TranscriptionOutput> stopRecording(ModelType type) async {
    if (type == ModelType.vosk) {
      final service = _voskService.speechService;
      if (service == null) throw Exception('Vosk service not available');
      await service.stop();
      await _partialSub?.cancel();
      await _resultSub?.cancel();
      final text = _accumulatedText.trim();
      _accumulatedText = '';
      return TranscriptionOutput(text: text, audioPath: '');
    } else {
      if (_whisperService == null) {
        throw Exception('Whisper service not available');
      }
      final audioFile = await _audioService.stopRecording();
      if (audioFile == null || !await audioFile.exists()) {
        throw Exception('Recorded audio file not found');
      }
      final fileSize = await audioFile.length();
      if (fileSize < 1000) throw Exception('Recording too short or empty');
      final transcriptionText = await _whisperService.transcribeFile(
        audioFile.path,
      );
      final text = transcriptionText?.trim() ?? '';
      return TranscriptionOutput(text: text, audioPath: audioFile.path);
    }
  }

  Future<void> dispose() async {
    await _partialSub?.cancel();
    await _resultSub?.cancel();
    await _partialController.close();
    await _audioService.dispose();
    await _voskService.dispose();
    await _whisperService?.dispose();
  }
}
