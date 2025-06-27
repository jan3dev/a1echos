import 'dart:io';
import 'dart:async';
import 'package:vosk_flutter/vosk_flutter.dart';
import 'dart:convert';

/// A buffer system for managing Vosk transcription results
class VoskResultBuffer {
  final List<String> _partialResults = [];
  final List<String> _finalResults = [];
  String _lastPartial = '';
  bool _isComplete = false;

  /// Adds a partial result, avoiding duplicates
  void addPartial(String partial) {
    if (partial.trim().isEmpty) return;

    if (partial != _lastPartial) {
      _lastPartial = partial;
      if (_finalResults.isEmpty ||
          !_finalResults.last.contains(partial.trim())) {
        _partialResults.add(partial);
      }
    }
  }

  /// Adds a final result
  void addFinalResult(String result) {
    if (result.trim().isEmpty) return;
    _finalResults.add(result);
    _isComplete = true;
  }

  /// Gets the complete accumulated text
  String getCompleteText() {
    if (_finalResults.isNotEmpty) {
      return _finalResults.join(' ').trim();
    }

    if (_partialResults.isNotEmpty) {
      return _partialResults.last.trim();
    }

    return '';
  }

  /// Checks if we have a complete result
  bool get isComplete => _isComplete || _finalResults.isNotEmpty;

  /// Clears all buffered results
  void clear() {
    _partialResults.clear();
    _finalResults.clear();
    _lastPartial = '';
    _isComplete = false;
  }

  /// Gets debug information
  String getDebugInfo() {
    return 'Partials: ${_partialResults.length}, Finals: ${_finalResults.length}, Complete: $_isComplete';
  }
}

/// A service that encapsulates Vosk plugin initialization, start/stop, and disposal.
class VoskService {
  VoskFlutterPlugin? _plugin;
  ModelLoader? _modelLoader;
  Model? _model;
  Recognizer? _recognizer;
  SpeechService? _speechService;
  final VoskResultBuffer _resultBuffer = VoskResultBuffer();
  bool _isShuttingDown = false;

  /// The underlying speech service after initialization.
  SpeechService? get speechService => _speechService;

  /// Gets the current result buffer
  VoskResultBuffer get resultBuffer => _resultBuffer;

  /// Loads the model from assets and initializes the speech service.
  Future<bool> initialize(String assetPath) async {
    // Vosk only supports Android platform
    if (!Platform.isAndroid) {
      return false;
    }

    bool initResult = false;
    try {
      // Initialize Vosk components only on Android
      _plugin = VoskFlutterPlugin.instance();
      _modelLoader = ModelLoader();

      final modelPath = await _modelLoader!.loadFromAssets(assetPath);
      _model = await _plugin!.createModel(modelPath);
      if (_model == null) throw Exception('Failed to create Vosk model');

      _recognizer = await _plugin!.createRecognizer(
        model: _model!,
        sampleRate: 16000,
      );
      if (_recognizer == null) {
        throw Exception('Failed to create Vosk recognizer');
      }

      _speechService = await _plugin!.initSpeechService(_recognizer!);
      initResult = _speechService != null;
    } catch (e) {
      // Vosk initialization failed
    }
    return initResult;
  }

  /// Starts streaming from the speech service.
  Future<void> start() async {
    _isShuttingDown = false;
    _resultBuffer.clear();
    await _speechService?.start();
  }

  /// Stops the speech service.
  Future<void> stop() async {
    await _speechService?.stop();
  }

  /// Requests final result from the recognizer with timeout
  Future<String?> getFinalResult({
    Duration timeout = const Duration(seconds: 2),
  }) async {
    if (_recognizer == null || _speechService == null) return null;

    try {
      final completer = Completer<String?>();
      Timer? timeoutTimer;
      StreamSubscription<String>? resultSub;

      timeoutTimer = Timer(timeout, () {
        if (!completer.isCompleted) {
          resultSub?.cancel();
          completer.complete(null);
        }
      });

      resultSub = _speechService!.onResult().listen((resultJson) {
        try {
          final data = jsonDecode(resultJson) as Map<String, dynamic>;
          final text = data['text'] as String? ?? '';
          if (text.trim().isNotEmpty && !completer.isCompleted) {
            timeoutTimer?.cancel();
            resultSub?.cancel();
            completer.complete(text);
          }
        } catch (e) {
          // Error parsing final result
        }
      });

      await Future.delayed(const Duration(milliseconds: 100));

      if (!completer.isCompleted) {
        timeoutTimer.cancel();
        resultSub.cancel();
        completer.complete(null);
      }

      return await completer.future;
    } catch (e) {
      return null;
    }
  }

  /// Performs graceful shutdown with final result capture
  Future<String> stopGracefully({
    Duration timeout = const Duration(seconds: 2),
  }) async {
    if (_isShuttingDown) {
      return _resultBuffer.getCompleteText();
    }

    _isShuttingDown = true;

    try {
      await stop();

      final finalResult = await getFinalResult(timeout: timeout);
      if (finalResult != null && finalResult.trim().isNotEmpty) {
        _resultBuffer.addFinalResult(finalResult);
      }

      final completeText = _resultBuffer.getCompleteText();

      return completeText;
    } catch (e) {
      return _resultBuffer.getCompleteText();
    }
  }

  /// Disposes all Vosk resources.
  Future<void> dispose() async {
    _isShuttingDown = true;
    try {
      await _speechService?.dispose();
    } catch (_) {}
    try {
      await _recognizer?.dispose();
    } catch (_) {}
    _model?.dispose();
    _resultBuffer.clear();
  }
}
