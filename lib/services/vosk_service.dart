import 'dart:io';
import 'dart:developer' as developer;
import 'package:vosk_flutter/vosk_flutter.dart';

/// A service that encapsulates Vosk plugin initialization, start/stop, and disposal.
class VoskService {
  final VoskFlutterPlugin _plugin = VoskFlutterPlugin.instance();
  Model? _model;
  Recognizer? _recognizer;
  SpeechService? _speechService;

  /// The underlying speech service after initialization.
  SpeechService? get speechService => _speechService;

  /// Loads the model from assets and initializes the speech service.
  Future<bool> initialize(String assetPath) async {
    bool initResult = false;
    try {
      final modelPath = await ModelLoader().loadFromAssets(assetPath);
      _model = await _plugin.createModel(modelPath);
      if (_model == null) throw Exception('Failed to create Vosk model');

      _recognizer = await _plugin.createRecognizer(
        model: _model!,
        sampleRate: 16000,
      );
      if (_recognizer == null) {
        throw Exception('Failed to create Vosk recognizer');
      }

      if (Platform.isAndroid) {
        _speechService = await _plugin.initSpeechService(_recognizer!);
        initResult = _speechService != null;
      } else {
        // On non-Android platforms, skip real-time streaming service
        initResult = true;
      }
    } catch (e, stack) {
      developer.log(
        'VoskService initialization error: $e',
        error: e,
        stackTrace: stack,
      );
    }
    return initResult;
  }

  /// Starts streaming from the speech service.
  Future<void> start() async {
    await _speechService?.start();
  }

  /// Stops the speech service.
  Future<void> stop() async {
    await _speechService?.stop();
  }

  /// Disposes all Vosk resources.
  Future<void> dispose() async {
    try {
      await _speechService?.dispose();
    } catch (_) {}
    try {
      await _recognizer?.dispose();
    } catch (_) {}
    _model?.dispose();
  }
}
