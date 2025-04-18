import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import '../models/transcription.dart';
import '../services/storage_service.dart';
import 'package:vosk_flutter/vosk_flutter.dart';
import 'dart:developer' as developer;
import 'dart:async';
import 'dart:convert';

class LocalTranscriptionProvider with ChangeNotifier {
  final StorageService _storageService = StorageService();
  final VoskFlutterPlugin _vosk = VoskFlutterPlugin.instance();
  Model? _model;
  Recognizer? _recognizer;
  SpeechService? _speechService;
  StreamSubscription<String>? _partialSubscription;
  StreamSubscription<String>? _resultSubscription;
  final Uuid _uuid = const Uuid();

  List<Transcription> _transcriptions = [];
  bool _isRecording = false;
  bool _isTranscribing = false;
  String? _error;
  bool _isModelInitialized = false;
  bool _isStreaming = false;
  String _currentStreamingText = '';
  String _accumulatedText = '';

  List<Transcription> get transcriptions => _transcriptions;
  bool get isRecording => _isRecording;
  bool get isTranscribing => _isTranscribing;
  String? get error => _error;
  bool get isModelReady => _isModelInitialized;
  String get currentStreamingText => _currentStreamingText;
  bool get isStreaming => _isStreaming;

  LocalTranscriptionProvider() {
    _loadTranscriptions();
    _initializeModel();
  }

  Future<void> _loadTranscriptions() async {
    try {
      _transcriptions = await _storageService.getTranscriptions();
      _transcriptions.sort((a, b) => a.timestamp.compareTo(b.timestamp));
      notifyListeners();
    } catch (e) {
      _error = 'Failed to load transcriptions';
      developer.log(
        'Error loading transcriptions: $e',
        name: 'LocalTranscriptionProvider',
        error: e,
      );
      notifyListeners();
    }
  }

  Future<void> loadTranscriptions() async {
    await _loadTranscriptions();
  }

  Future<void> _initializeModel() async {
    try {
      _isTranscribing = true;
      notifyListeners();

      final modelPath = await ModelLoader().loadFromAssets(
        'assets/models/vosk-model-small-en-us-0.15.zip',
      );
      _model = await _vosk.createModel(modelPath);
      _recognizer = await _vosk.createRecognizer(
        model: _model!,
        sampleRate: 16000,
      );
      _speechService = await _vosk.initSpeechService(_recognizer!);

      _isModelInitialized = _speechService != null;
      if (!_isModelInitialized) {
        _error = 'Failed to initialize Vosk plugin';
      }
    } catch (e) {
      _error = 'Error initializing model: $e';
      _isModelInitialized = false;
    } finally {
      _isTranscribing = false;
      notifyListeners();
    }
  }

  Future<bool> startRecording() async {
    _error = null;
    if (!_isModelInitialized || _speechService == null) {
      _error = 'Model not ready';
      notifyListeners();
      return false;
    }
    try {
      _partialSubscription = _speechService!.onPartial().listen((partialJson) {
        try {
          final data = jsonDecode(partialJson) as Map<String, dynamic>;
          final partial = data['partial'] as String? ?? '';
          if (partial.trim().isEmpty) return;
          // Show accumulated text plus new partial
          _currentStreamingText =
              _accumulatedText.isEmpty ? partial : '$_accumulatedText $partial';
          notifyListeners();
        } catch (_) {}
      });
      _resultSubscription = _speechService!.onResult().listen((resultJson) {
        try {
          final data = jsonDecode(resultJson) as Map<String, dynamic>;
          final text = data['text'] as String? ?? '';
          if (text.trim().isEmpty) return;
          // Append finished segment
          _accumulatedText =
              _accumulatedText.isEmpty ? text : '$_accumulatedText $text';
          _currentStreamingText = _accumulatedText;
          notifyListeners();
        } catch (_) {}
      });
      await _speechService!.start();
      _isRecording = true;
      _isStreaming = true;
      // Reset buffers at start
      _accumulatedText = '';
      _currentStreamingText = '';
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'Failed to start speech service: $e';
      _isRecording = false;
      _isStreaming = false;
      notifyListeners();
      return false;
    }
  }

  String _formatTranscriptionText(String text) {
    if (text.isEmpty) return text;

    String normalizedText = text.trim().replaceAll(RegExp(r'\s+'), ' ');

    // Fallback for transcripts without punctuation: split into word-based paragraphs
    if (!RegExp(r'[.?!]').hasMatch(normalizedText)) {
      final words = normalizedText.split(' ');
      const int wordsPerParagraph = 30;
      final List<String> paras = [];
      for (int i = 0; i < words.length; i += wordsPerParagraph) {
        final end =
            (i + wordsPerParagraph < words.length)
                ? i + wordsPerParagraph
                : words.length;
        paras.add(words.sublist(i, end).join(' '));
      }
      return paras.join('\n\n');
    }

    // Look for patterns like "• " or "- " or "1. " etc.
    final bulletRegex = RegExp(r'(?:^|\n|\s)(?:[•\-\*]|\d+\.)\s');
    if (bulletRegex.hasMatch(normalizedText)) {
      // Insert newlines before bullet points if they don't already have them
      normalizedText = normalizedText.replaceAllMapped(
        RegExp(r'(?<!\n)(?<!\n\s)(?<!\n\n)(\s*)(?:[•\-\*]|\d+\.)\s'),
        (match) => '\n${match.group(1)}${match.group(0)}',
      );

      normalizedText = normalizedText.replaceAll(RegExp(r'\n\n+'), '\n\n');

      return normalizedText;
    }

    // For non-bullet text, use sentence-based formatting
    final List<String> sentences = [];
    String currentSentence = "";

    for (int i = 0; i < normalizedText.length; i++) {
      currentSentence += normalizedText[i];

      if ((normalizedText[i] == '.' ||
              normalizedText[i] == '!' ||
              normalizedText[i] == '?') &&
          (i == normalizedText.length - 1 || normalizedText[i + 1] == ' ')) {
        sentences.add(currentSentence.trim());
        currentSentence = "";
      }
    }

    if (currentSentence.trim().isNotEmpty) {
      sentences.add(currentSentence.trim());
    }

    // Build paragraphs (3 sentences per paragraph)
    final List<String> paragraphs = [];
    for (int i = 0; i < sentences.length; i += 3) {
      final int end = i + 3 < sentences.length ? i + 3 : sentences.length;
      final paragraph = sentences.sublist(i, end).join(' ');
      paragraphs.add(paragraph);
    }

    return paragraphs.join('\n\n');
  }

  Future<void> stopRecordingAndSave() async {
    _error = null;
    if (!_isRecording || _speechService == null) return;
    try {
      await _speechService!.stop();
      // Cancel streaming subscriptions to avoid empty events
      await _partialSubscription?.cancel();
      await _resultSubscription?.cancel();
      _partialSubscription = null;
      _resultSubscription = null;
      _isRecording = false;
      _isStreaming = false;
      notifyListeners();

      if (_currentStreamingText.trim().isEmpty) {
        _error = 'No speech detected';
        notifyListeners();
        return;
      }

      _isTranscribing = true;
      notifyListeners();

      final formattedText = _formatTranscriptionText(_currentStreamingText);
      final transcription = Transcription(
        id: _uuid.v4(),
        text: formattedText,
        timestamp: DateTime.now(),
        audioPath: '',
      );
      await _storageService.saveTranscription(transcription);
      await _loadTranscriptions();

      _isTranscribing = false;
      _currentStreamingText = '';
      notifyListeners();
    } catch (e) {
      _error = 'Failed to stop service and save: $e';
      _isTranscribing = false;
      notifyListeners();
    }
  }

  Future<void> deleteTranscription(String id) async {
    _error = null;
    try {
      await _storageService.deleteTranscription(id);
      await _loadTranscriptions();
    } catch (e) {
      _error = 'Failed to delete transcription';
      developer.log(
        'Error deleting transcription: $e',
        name: 'LocalTranscriptionProvider',
        error: e,
      );
      notifyListeners();
    }
  }

  Future<void> clearTranscriptions() async {
    _error = null;
    try {
      await _storageService.clearTranscriptions();
      await _loadTranscriptions();
    } catch (e) {
      _error = 'Failed to clear transcriptions';
      developer.log(
        'Error clearing transcriptions: $e',
        name: 'LocalTranscriptionProvider',
        error: e,
      );
      notifyListeners();
    }
  }

  Future<void> deleteParagraphFromTranscription(
    String id,
    int paragraphIndex,
  ) async {
    _error = null;
    try {
      final transcriptionIndex = _transcriptions.indexWhere((t) => t.id == id);
      if (transcriptionIndex < 0) {
        throw Exception('Transcription not found');
      }

      final transcription = _transcriptions[transcriptionIndex];
      final originalText = transcription.text;
      final List<String> paragraphs = originalText.split('\n\n');

      if (paragraphIndex < 0 || paragraphIndex >= paragraphs.length) {
        throw Exception('Invalid paragraph index');
      }

      paragraphs.removeAt(paragraphIndex);

      if (paragraphs.isEmpty) {
        await deleteTranscription(id);
        return;
      }

      final newText = paragraphs.join('\n\n');

      final newTranscription = Transcription(
        id: transcription.id,
        text: newText,
        timestamp: transcription.timestamp,
        audioPath: transcription.audioPath,
      );

      _transcriptions[transcriptionIndex] = newTranscription;
      notifyListeners();

      await _storageService.deleteTranscription(id);
      await _storageService.saveTranscription(newTranscription);
      await _loadTranscriptions();
    } catch (e) {
      _error = 'Failed to delete paragraph';
      developer.log(
        'Error deleting paragraph: $e',
        name: 'LocalTranscriptionProvider',
        error: e,
      );
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _speechService?.stop();
    super.dispose();
  }
}
