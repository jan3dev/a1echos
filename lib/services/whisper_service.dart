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
  bool _isDownloadingModel = false;
  String? _initializationStatus;

  /// Returns whether the service has been successfully initialized.
  bool get isInitialized => _isInitialized;

  /// Returns whether a transcription is currently in progress.
  bool get isTranscribing => _isTranscribing;

  /// Returns whether the model is currently being downloaded.
  bool get isDownloadingModel => _isDownloadingModel;

  /// Returns the current initialization status message.
  String? get initializationStatus => _initializationStatus;

  /// Initializes the Whisper instance if not already initialized.
  Future<bool> initialize() async {
    if (_isInitialized) return true;
    if (_isInitializing) return false;
    _isInitializing = true;
    _initializationStatus = 'Starting initialization...';

    try {
      developer.log('WhisperService: Starting initialization...');

      // Initialize Whisper with base model
      _initializationStatus = 'Creating Whisper instance...';
      _whisperInstance = Whisper(model: WhisperModel.base);
      developer.log('WhisperService: Whisper instance created');

      // Check if model needs to be downloaded (first time setup)
      _initializationStatus = 'Checking model availability...';
      _isDownloadingModel = true;

      // Extended timeout for iOS model download (can take several minutes on first run)
      final version = await _whisperInstance?.getVersion().timeout(
        const Duration(minutes: 5),
        onTimeout: () {
          throw TimeoutException(
            'Whisper model download/initialization timed out after 5 minutes',
          );
        },
      );

      _isDownloadingModel = false;
      developer.log('WhisperService: Version retrieved: $version');

      if (version != null && version.isNotEmpty) {
        _isInitialized = true;
        _initializationStatus = 'Whisper ready';
        developer.log(
          'WhisperService: Initialization successful with version: $version',
        );
      } else {
        throw Exception(
          'Whisper getVersion returned null or empty - model may not be ready',
        );
      }
    } on TimeoutException catch (e) {
      developer.log('WhisperService initialization timeout: $e');
      _initializationStatus = 'Model download timed out. Please try again.';
      _isInitialized = false;
      _whisperInstance = null;
      _isDownloadingModel = false;
    } catch (e, stack) {
      developer.log(
        'WhisperService initialization error: $e',
        error: e,
        stackTrace: stack,
      );

      // Provide more specific error messages for common iOS issues
      if (e.toString().contains('PlatformException')) {
        _initializationStatus =
            'Platform initialization failed. This may be due to iOS simulator limitations or missing dependencies.';
      } else if (e.toString().contains('network') ||
          e.toString().contains('download')) {
        _initializationStatus =
            'Model download failed. Check your internet connection and try again.';
      } else if (e.toString().contains('timeout')) {
        _initializationStatus =
            'Initialization timed out. This is common on iOS simulator - try on a real device.';
      } else {
        _initializationStatus =
            'Initialization failed: ${e.toString().length > 100 ? '${e.toString().substring(0, 100)}...' : e.toString()}';
      }

      _isInitialized = false;
      _whisperInstance = null;
      _isDownloadingModel = false;
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
