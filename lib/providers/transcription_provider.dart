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
      developer.log('Error loading transcriptions: $e', name: 'TranscriptionProvider', error: e);
      notifyListeners();
    }
  }
  
  Future<void> loadTranscriptions() async {
    await _loadTranscriptions();
  }
  
  Future<bool> startRecording() async {
    _error = null;
    try {
      developer.log('Starting recording session', name: 'TranscriptionProvider');
      final result = await _audioService.startRecording();
      _isRecording = result;
      notifyListeners();
      return result;
    } catch (e) {
      _error = 'Failed to start recording';
      developer.log('Error starting recording: $e', name: 'TranscriptionProvider', error: e);
      notifyListeners();
      return false;
    }
  }
  
  String _formatTranscriptionText(String text) {
    if (text.isEmpty) return text;
    
    developer.log('Formatting transcription text of length: ${text.length}', name: 'TranscriptionProvider');
    
    // Clean up the text first
    String normalizedText = text.trim().replaceAll(RegExp(r'\s+'), ' ');
    
    // Special handling for bullet points
    // Look for patterns like "• " or "- " or "1. " etc.
    final bulletRegex = RegExp(r'(?:^|\n|\s)(?:[•\-\*]|\d+\.)\s');
    if (bulletRegex.hasMatch(normalizedText)) {
      // Text likely contains bullet points, preserve its structure
      
      // Insert newlines before bullet points if they don't already have them
      normalizedText = normalizedText.replaceAllMapped(
        RegExp(r'(?<!\n)(?<!\n\s)(?<!\n\n)(\s*)(?:[•\-\*]|\d+\.)\s'),
        (match) => '\n${match.group(1)}${match.group(0)}'
      );
      
      // Ensure there are double newlines between bullet point sections
      normalizedText = normalizedText.replaceAll(RegExp(r'\n\n+'), '\n\n');
      
      return normalizedText;
    }
    
    // For non-bullet text, use sentence-based formatting
    final List<String> sentences = [];
    String currentSentence = "";
    
    // Process character by character for sentence detection
    for (int i = 0; i < normalizedText.length; i++) {
      currentSentence += normalizedText[i];
      
      // Check if we have a sentence end (., !, or ?)
      if ((normalizedText[i] == '.' || 
           normalizedText[i] == '!' || 
           normalizedText[i] == '?') && 
          (i == normalizedText.length - 1 || normalizedText[i + 1] == ' ')) {
        sentences.add(currentSentence.trim());
        currentSentence = "";
      }
    }
    
    // Add any remaining text as a sentence
    if (currentSentence.trim().isNotEmpty) {
      sentences.add(currentSentence.trim());
    }
    
    developer.log('Split transcription into ${sentences.length} sentences', name: 'TranscriptionProvider');
    
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
      developer.log('Not recording, cannot stop and transcribe', name: 'TranscriptionProvider');
      return;
    }
    
    try {
      _isRecording = false;
      notifyListeners();
      
      developer.log('Stopping recording and preparing to transcribe', name: 'TranscriptionProvider');
      final audioFile = await _audioService.stopRecording();
      if (audioFile == null) {
        _error = 'Recording failed';
        developer.log('No audio file returned after stopping recording', name: 'TranscriptionProvider');
        notifyListeners();
        return;
      }
      
      // Check audio file properties
      final fileSize = await audioFile.length();
      developer.log('Audio file size: ${(fileSize / 1024).toStringAsFixed(2)}KB, path: ${audioFile.path}', 
                   name: 'TranscriptionProvider');
      
      // Verify the file is valid and has content
      if (fileSize < 100) { // Less than 100 bytes
        _error = 'Recording too short or empty';
        developer.log('Audio file too small, likely empty recording', name: 'TranscriptionProvider');
        notifyListeners();
        return;
      }
      
      _isTranscribing = true;
      notifyListeners();
      
      developer.log('Starting transcription process', name: 'TranscriptionProvider');
      final transcriptionText = await _apiService.transcribeAudio(audioFile);
      
      developer.log('Received transcription of length: ${transcriptionText.length}', 
                   name: 'TranscriptionProvider');
      
      // Don't attempt to format empty or very short transcriptions
      final String formattedText;
      if (transcriptionText.length < 5) {
        formattedText = transcriptionText;
        developer.log('Transcription too short to format', name: 'TranscriptionProvider');
      } else {
        formattedText = _formatTranscriptionText(transcriptionText);
      }
          
      final fileName = 'audio_${DateTime.now().millisecondsSinceEpoch}.m4a';
      final storedAudioPath = await _storageService.saveAudioFile(audioFile, fileName);
      
      developer.log('Creating transcription record', name: 'TranscriptionProvider');
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
      
      developer.log('Transcription process completed successfully', name: 'TranscriptionProvider');
    } catch (e) {
      _isTranscribing = false;
      _error = 'Transcription failed: ${e.toString()}';
      developer.log('Error during transcription process: $e', name: 'TranscriptionProvider', error: e);
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
      developer.log('Error deleting transcription: $e', name: 'TranscriptionProvider', error: e);
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
      developer.log('Error clearing transcriptions: $e', name: 'TranscriptionProvider', error: e);
      notifyListeners();
    }
  }
  
  Future<void> _checkApiKey() async {
    try {
      final hasKey = await _apiService.hasApiKey();
      _hasApiKey = hasKey;
      notifyListeners();
    } catch (e) {
      // Handle any error
      _hasApiKey = false;
      developer.log('Error checking API key: $e', name: 'TranscriptionProvider', error: e);
      notifyListeners();
    }
  }
  
  Future<void> refreshApiKeyStatus() async {
    await _checkApiKey();
  }
  
  @override
  void dispose() {
    _audioService.dispose();
    super.dispose();
  }
} 