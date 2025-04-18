import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class NativeVoskService {
  static const MethodChannel _methodChannel = MethodChannel(
    'com.example.transcription_app/vosk',
  );
  static const EventChannel _resultChannel = EventChannel(
    'com.example.transcription_app/vosk_results',
  );

  final StreamController<String> _transcriptionStreamController =
      StreamController<String>.broadcast();
  Stream<String> get transcriptionStream =>
      _transcriptionStreamController.stream;

  bool _isInitialized = false;
  bool _isRecognizing = false;
  String _currentTranscription = '';

  NativeVoskService() {
    // Listen to transcription results from the native side
    _resultChannel.receiveBroadcastStream().listen(_handleTranscriptionEvent);
  }

  // Handle events from the native platform
  void _handleTranscriptionEvent(dynamic event) {
    if (event is! Map) return;

    final eventType = event['type'] as String?;
    final text = event['text'] as String?;

    if (eventType == 'partial' && text != null) {
      _currentTranscription = text;
      _transcriptionStreamController.add(_currentTranscription);
    } else if (eventType == 'final' && text != null) {
      _currentTranscription += '$text ';
      _transcriptionStreamController.add(_currentTranscription);
    }
  }

  // Initialize the Vosk recognizer with the model path
  Future<bool> initialize(String modelPath) async {
    if (_isInitialized) return true;

    try {
      final result = await _methodChannel.invokeMethod<bool>('initialize', {
        'modelPath': modelPath,
      });

      _isInitialized = result ?? false;
      return _isInitialized;
    } catch (e) {
      debugPrint('Failed to initialize Vosk: $e');
      return false;
    }
  }

  // Start speech recognition
  Future<bool> startRecognition() async {
    if (!_isInitialized) {
      return false;
    }

    if (_isRecognizing) {
      return true;
    }

    try {
      final result = await _methodChannel.invokeMethod<bool>(
        'startRecognition',
      );
      _isRecognizing = result ?? false;

      if (_isRecognizing) {
        _currentTranscription = '';
      }

      return _isRecognizing;
    } catch (e) {
      debugPrint('Failed to start recognition: $e');
      return false;
    }
  }

  // Stop speech recognition
  Future<bool> stopRecognition() async {
    if (!_isRecognizing) {
      return true;
    }

    try {
      final result = await _methodChannel.invokeMethod<bool>('stopRecognition');
      _isRecognizing = !(result ?? false);
      return !_isRecognizing;
    } catch (e) {
      debugPrint('Failed to stop recognition: $e');
      return false;
    }
  }

  // Feed audio data to the recognizer
  Future<bool> processAudio(Uint8List audioData) async {
    if (!_isRecognizing || !_isInitialized) {
      return false;
    }

    try {
      return await _methodChannel.invokeMethod<bool>('processAudio', {
            'audioData': audioData,
          }) ??
          false;
    } catch (e) {
      debugPrint('Failed to process audio: $e');
      return false;
    }
  }

  // Check if recognizer is running
  Future<bool> isRecognizing() async {
    try {
      return await _methodChannel.invokeMethod<bool>('isRecognizing') ?? false;
    } catch (e) {
      return _isRecognizing;
    }
  }

  // Clear the current transcription
  void clearTranscription() {
    _currentTranscription = '';
    _transcriptionStreamController.add('');
  }

  // Get the current transcription
  String getTranscription() {
    return _currentTranscription;
  }

  // Dispose resources
  Future<void> dispose() async {
    await stopRecognition();
    await _transcriptionStreamController.close();
    _isInitialized = false;
    _isRecognizing = false;
  }
}
