import 'dart:async';
import 'dart:io';
import 'package:whisper_flutter_new/whisper_flutter_new.dart' as fwn;
import 'package:flutter_whisper_kit/flutter_whisper_kit.dart' as kit;

/// A service that abstracts Whisper functionality for both Android (whisper_flutter_new)
/// and iOS (flutter_whisper_kit) back-ends.
class WhisperService {
  // Android implementation --------------------------------------------------
  fwn.Whisper? _androidWhisper;

  // iOS implementation ------------------------------------------------------
  kit.FlutterWhisperKit? _iosKit;

  // Realtime streaming support (iOS)
  StreamSubscription<dynamic>? _iosPartialSub;
  final StreamController<String> _partialController =
      StreamController<String>.broadcast();

  /// Stream of partial transcription results (only emitted during real-time recording).
  Stream<String> get onPartial => _partialController.stream;

  bool _isInitialized = false;
  bool _isInitializing = false;
  bool _isTranscribing = false;
  bool _isRealtimeRecording = false;
  String _currentTranscription = '';
  String? _initializationStatus;

  /// Returns whether the service has been successfully initialized.
  bool get isInitialized => _isInitialized;

  /// Returns whether a transcription is currently in progress.
  bool get isTranscribing => _isTranscribing;

  /// Returns the current initialization status message.
  String? get initializationStatus => _initializationStatus;

  // =========================================================================
  // INITIALIZATION
  // =========================================================================

  Future<bool> initialize() async {
    if (_isInitialized) return true;
    if (_isInitializing) return false;

    _isInitializing = true;
    _initializationStatus = 'Starting initialization...';

    try {
      if (Platform.isAndroid) {
        _initializationStatus = 'Creating Whisper instance...';
        _androidWhisper = fwn.Whisper(model: fwn.WhisperModel.tiny);
        _initializationStatus = 'Whisper Flutter New ready';
      } else if (Platform.isIOS) {
        _initializationStatus = 'Creating FlutterWhisperKit instance...';
        _iosKit = kit.FlutterWhisperKit();

        _initializationStatus = 'Loading CoreML model...';

        bool modelLoaded = false;
        const modelRepo = 'argmaxinc/whisperkit-coreml';

        // Try loading models in order of preference
        final modelsToTry = ['tiny'];

        for (final modelName in modelsToTry) {
          if (modelLoaded) break;

          try {
            _initializationStatus = 'Loading $modelName model...';
            final loadResult = await _iosKit!
                .loadModel(modelName, modelRepo: modelRepo, redownload: false)
                .timeout(const Duration(minutes: 5));

            if (loadResult != null &&
                !loadResult.toString().toLowerCase().contains('fail')) {
              _initializationStatus = '$modelName model loaded successfully';
              modelLoaded = true;
            } else {
              _initializationStatus = 'Failed to load $modelName model';
            }
          } catch (e) {
            _initializationStatus =
                'Error loading $modelName model: ${e.toString()}';
          }
        }

        if (!modelLoaded) {
          throw Exception('Failed to load any Whisper model variants');
        }

        _initializationStatus = 'Flutter Whisper Kit ready';
      } else {
        _initializationStatus =
            'Unsupported platform for WhisperService: ${Platform.operatingSystem}';
        _isInitializing = false;
        return false;
      }

      _isInitialized = true;
      return true;
    } catch (e) {
      _initializationStatus = 'Initialization failed: $e';
      _resetState();
      return false;
    } finally {
      _isInitializing = false;
    }
  }

  // =========================================================================
  // FILE-BASED TRANSCRIPTION
  // =========================================================================

  Future<String?> transcribeFile(String audioPath) async {
    if (!_isInitialized) {
      throw Exception('Whisper service not initialized.');
    }
    if (_isTranscribing) {
      throw Exception('Transcription already in progress.');
    }

    final audioFile = File(audioPath);
    if (!await audioFile.exists()) {
      throw Exception('Audio file not found at: $audioPath');
    }

    try {
      _isTranscribing = true;

      if (Platform.isAndroid) {
        final result = await _androidWhisper?.transcribe(
          transcribeRequest: fwn.TranscribeRequest(
            audio: audioPath,
            isTranslate: false,
            isNoTimestamps: true,
          ),
        );

        return result?.text.trim();
      } else if (Platform.isIOS) {
        final options = kit.DecodingOptions(
          task: kit.DecodingTask.transcribe,
          detectLanguage: true,
          language: null,
        );

        final transcription = await _iosKit!.transcribeFromFile(
          audioPath,
          options: options,
        );

        return transcription?.text.trim();
      } else {
        throw Exception('Unsupported platform');
      }
    } catch (e) {
      rethrow;
    } finally {
      _isTranscribing = false;
    }
  }

  // =========================================================================
  // REAL-TIME RECORDING (iOS only)
  // =========================================================================

  /// Starts real-time transcription. Returns true when recording started.
  Future<bool> startRealtimeRecording() async {
    if (!Platform.isIOS) {
      return false;
    }
    if (_iosKit == null) {
      return false;
    }
    if (!_isInitialized) {
      return false;
    }
    if (_isRealtimeRecording) {
      return false;
    }

    _currentTranscription = '';

    try {
      await _setupTranscriptionListener();

      await _iosKit!.startRecording(
        options: kit.DecodingOptions(
          task: kit.DecodingTask.transcribe,
          detectLanguage: true,
          language: null,
        ),
      );

      _isRealtimeRecording = true;
      return true;
    } catch (e) {
      await _iosPartialSub?.cancel();
      _isRealtimeRecording = false;
      return false;
    }
  }

  /// Sets up the transcription stream listener
  Future<void> _setupTranscriptionListener() async {
    await _iosPartialSub?.cancel();

    try {
      _iosPartialSub = _iosKit!.transcriptionStream.listen(
        (event) {
          _handleTranscriptionEvent(event);
        },
        onError: (error) {},
        onDone: () {},
      );
    } catch (e) {
      rethrow;
    }
  }

  /// Handles transcription events from the stream
  void _handleTranscriptionEvent(dynamic event) {
    try {
      String text = '';
      if (event != null) {
        if (event.text != null) {
          text = event.text.toString().trim();
        } else {
          text = event.toString().trim();
        }
      }

      if (text.isNotEmpty) {
        _currentTranscription = text;
        _partialController.add(text);
      }
    } catch (e) {
      rethrow;
    }
  }

  /// Stops real-time recording and returns the final transcription.
  Future<String> stopRealtimeRecording() async {
    if (!Platform.isIOS) return '';
    if (_iosKit == null) return '';
    if (!_isRealtimeRecording) return '';

    try {
      await _iosKit!.stopRecording();
      return _currentTranscription;
    } finally {
      _isRealtimeRecording = false;
      await _iosPartialSub?.cancel();
    }
  }

  // =========================================================================
  // CLEANUP
  // =========================================================================

  Future<void> dispose() async {
    _androidWhisper = null;
    await _iosPartialSub?.cancel();
    _iosKit = null;
    _resetState();
  }

  void _resetState() {
    _isInitialized = false;
    _isInitializing = false;
    _isTranscribing = false;
    _isRealtimeRecording = false;
  }
}
