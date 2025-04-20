import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import '../models/transcription.dart';
import '../services/storage_service.dart';
import '../services/api_service.dart';
import '../services/audio_service.dart';
import 'dart:developer' as developer;

class TranscriptionProvider with ChangeNotifier {
  final StorageService _storageService = StorageService();
  final ApiService _apiService = ApiService();
  final AudioService _audioService = AudioService();
  final Uuid _uuid = const Uuid();

  List<Transcription> _transcriptions = [];
  bool _isRecording = false;
  bool _isTranscribing = false;
  String? _error;
  bool _hasApiKey = false;

  List<Transcription> get transcriptions => _transcriptions;
  bool get isRecording => _isRecording;
  bool get isTranscribing => _isTranscribing;
  String? get error => _error;
  bool get hasApiKey => _hasApiKey;

  TranscriptionProvider() {
    _loadTranscriptions();
    _checkApiKey();
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
        name: 'TranscriptionProvider',
        error: e,
      );
      notifyListeners();
    }
  }

  Future<void> loadTranscriptions() async {
    await _loadTranscriptions();
  }

  Future<bool> startRecording() async {
    _error = null;
    try {
      final result = await _audioService.startRecording(useStreaming: true);
      _isRecording = result;
      notifyListeners();
      return result;
    } catch (e) {
      _error = 'Failed to start recording';
      developer.log(
        'Error starting recording: $e',
        name: 'TranscriptionProvider',
        error: e,
      );
      notifyListeners();
      return false;
    }
  }

  String _formatTranscriptionText(String text) {
    if (text.isEmpty) return text;

    String normalizedText = text.trim().replaceAll(RegExp(r'\s+'), ' ');

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

  Future<void> stopRecordingAndTranscribe() async {
    _error = null;

    if (!_isRecording) {
      return;
    }

    try {
      _isRecording = false;
      notifyListeners();

      final audioFile = await _audioService.stopRecording();
      if (audioFile == null) {
        _error = 'Recording failed';
        notifyListeners();
        return;
      }

      final fileSize = await audioFile.length();

      if (fileSize < 100) {
        _error = 'Recording too short or empty';
        notifyListeners();
        return;
      }

      _isTranscribing = true;
      notifyListeners();

      final transcriptionText = await _apiService.transcribeAudio(audioFile);

      // Don't attempt to format empty or very short transcriptions
      final String formattedText;
      if (transcriptionText.length < 5) {
        formattedText = transcriptionText;
      } else {
        formattedText = _formatTranscriptionText(transcriptionText);
      }

      final fileName = 'audio_${DateTime.now().millisecondsSinceEpoch}.m4a';
      final storedAudioPath = await _storageService.saveAudioFile(
        audioFile,
        fileName,
      );

      final transcription = Transcription(
        id: _uuid.v4(),
        text: formattedText,
        timestamp: DateTime.now(),
        audioPath: storedAudioPath,
      );

      await _storageService.saveTranscription(transcription);
      await _loadTranscriptions();

      _isTranscribing = false;
      notifyListeners();
    } catch (e) {
      _isTranscribing = false;
      _error = 'Transcription failed: ${e.toString()}';
      developer.log(
        'Error during transcription process: $e',
        name: 'TranscriptionProvider',
        error: e,
      );
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
        name: 'TranscriptionProvider',
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
        name: 'TranscriptionProvider',
        error: e,
      );
      notifyListeners();
    }
  }

  Future<void> _checkApiKey() async {
    try {
      final hasKey = await _apiService.hasApiKey();
      _hasApiKey = hasKey;
      notifyListeners();
    } catch (e) {
      _hasApiKey = false;
      developer.log(
        'Error checking API key: $e',
        name: 'TranscriptionProvider',
        error: e,
      );
      notifyListeners();
    }
  }

  Future<void> refreshApiKeyStatus() async {
    await _checkApiKey();
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

      notifyListeners();
    } catch (e) {
      _error = 'Failed to delete paragraph';
      developer.log(
        'Error deleting paragraph: $e',
        name: 'TranscriptionProvider',
        error: e,
      );
      notifyListeners();
    }
  }

  int min(int a, int b) {
    return a < b ? a : b;
  }

  @override
  void dispose() {
    _audioService.dispose();
    super.dispose();
  }
}
