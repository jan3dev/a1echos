import 'dart:async';
import 'dart:io';
import 'dart:developer' as developer;
import 'package:whisper_flutter_new/whisper_flutter_new.dart';

/// A service that encapsulates Whisper plugin initialization, transcription, and disposal.
class WhisperService {
  Whisper? _whisperInstance;
  bool _isInitialized = false;
  bool _isInitializing = false;
  bool _isTranscribing = false;

  /// Returns whether the service has been successfully initialized.
  bool get isInitialized => _isInitialized;

  /// Returns whether a transcription is currently in progress.
  bool get isTranscribing => _isTranscribing;

  /// Initializes the Whisper instance if not already initialized.
  Future<bool> initialize() async {
    if (_isInitialized) return true;
    if (_isInitializing) return false;
    _isInitializing = true;
    try {
      _whisperInstance = Whisper(model: WhisperModel.base);
      final version = await _whisperInstance?.getVersion();
      if (version != null) {
        _isInitialized = true;
      } else {
        throw Exception('Whisper getVersion returned null.');
      }
    } catch (e, stack) {
      developer.log(
        'WhisperService initialization error: $e',
        error: e,
        stackTrace: stack,
      );
      _isInitialized = false;
      _whisperInstance = null;
    } finally {
      _isInitializing = false;
    }
    return _isInitialized;
  }

  /// Transcribes the given audio file and returns the recognized text.
  Future<String?> transcribeFile(String audioPath) async {
    if (!_isInitialized || _whisperInstance == null) {
      throw Exception('Whisper service not initialized.');
    }
    if (_isTranscribing) {
      throw Exception('Transcription already in progress.');
    }
    _isTranscribing = true;
    try {
      final audioFile = File(audioPath);
      if (!await audioFile.exists()) {
        throw Exception('Audio file not found at: $audioPath');
      }
      final WhisperTranscribeResponse response = await _whisperInstance!
          .transcribe(
            transcribeRequest: TranscribeRequest(
              audio: audioPath,
              language: 'en',
              isTranslate: false,
              isNoTimestamps: true,
            ),
          );
      return response.text;
    } catch (e, stack) {
      developer.log(
        'WhisperService transcription error: $e',
        error: e,
        stackTrace: stack,
      );
      throw Exception('Whisper transcription failed: $e');
    } finally {
      _isTranscribing = false;
    }
  }

  /// Disposes the Whisper instance and resets state.
  Future<void> dispose() async {
    _whisperInstance = null;
    _isInitialized = false;
    _isInitializing = false;
    _isTranscribing = false;
  }
}
