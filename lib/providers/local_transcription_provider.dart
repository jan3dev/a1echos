import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import '../models/transcription.dart';
import '../services/storage_service.dart';
import 'package:vosk_flutter/vosk_flutter.dart';
import '../services/whisper_file_service.dart';
import '../services/audio_service.dart';
import '../services/model_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:developer' as developer;
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import '../models/session.dart';

class LocalTranscriptionProvider with ChangeNotifier {
  final StorageService _storageService = StorageService();
  final AudioService _audioService = AudioService();
  final VoskFlutterPlugin _voskPlugin = VoskFlutterPlugin.instance();
  Model? _voskModel;
  Recognizer? _voskRecognizer;
  SpeechService? _voskSpeechService;
  WhisperFileService? _whisperService;
  final Uuid _uuid = const Uuid();
  List<Transcription> _transcriptions = [];
  bool _isRecording = false;
  bool _isLoading = true;
  bool _isTranscribing = false;
  String? _error;
  bool _isModelInitialized = false;
  ModelType _selectedModelType = ModelType.vosk;
  static const String _prefsKeyModelType = 'selected_model_type';
  bool _isStreaming = false;
  String _currentStreamingText = '';
  String _accumulatedText = '';
  StreamSubscription? _voskPartialSubscription;
  StreamSubscription? _voskResultSubscription;
  static const String _prefsKeySessions = 'sessions';
  static const String _prefsKeyActiveSession = 'active_session';
  List<Session> _sessions = [];
  String _activeSessionId = '';

  List<Transcription> get transcriptions => _transcriptions;
  bool get isRecording => _isRecording;
  bool get isTranscribing => _isTranscribing;
  String? get error => _error;
  bool get isModelReady => _isModelInitialized;
  String get currentStreamingText => _currentStreamingText;
  bool get isStreaming => _isStreaming;
  ModelType get selectedModelType => _selectedModelType;
  bool get isLoading => _isLoading;
  List<Session> get sessions => _sessions;
  String get activeSessionId => _activeSessionId;
  Session get activeSession =>
      _sessions.firstWhere((s) => s.id == _activeSessionId);
  List<Transcription> get sessionTranscriptions =>
      _transcriptions.where((t) => t.sessionId == _activeSessionId).toList();

  LocalTranscriptionProvider() {
    _initialize();
  }

  Future<void> _initialize() async {
    await _loadSessions();
    _isLoading = true;
    notifyListeners();
    await _loadTranscriptions();
    await _loadSelectedModelType();
    await _initializeSelectedModel(_selectedModelType);
    _isLoading = false;
    notifyListeners();
  }

  Future<void> _loadSelectedModelType() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final modelName =
          prefs.getString(_prefsKeyModelType) ?? ModelType.vosk.name;
      _selectedModelType = ModelType.values.firstWhere(
        (e) => e.name == modelName,
        orElse: () => ModelType.vosk,
      );
    } catch (e) {
      developer.log(
        'Error loading selected model type: $e',
        name: 'LocalTranscriptionProvider',
      );
      _selectedModelType = ModelType.vosk;
    }
  }

  Future<void> _saveSelectedModelType(ModelType type) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefsKeyModelType, type.name);
    } catch (e) {
      developer.log(
        'Error saving selected model type: $e',
        name: 'LocalTranscriptionProvider',
      );
    }
  }

  Future<void> changeModel(ModelType newModelType) async {
    if (_selectedModelType == newModelType && _isModelInitialized) return;

    _isLoading = true;
    _isModelInitialized = false;
    _error = null;
    ModelType previousModelType = _selectedModelType;
    _selectedModelType = newModelType;
    notifyListeners();

    try {
      if (previousModelType == ModelType.whisper) {
        _whisperService?.dispose();
        _whisperService = null;
      } else if (previousModelType == ModelType.vosk) {
        if (_voskSpeechService != null) {
          await _voskSpeechService!.dispose();
        }
        if (_voskRecognizer != null) {
          await _voskRecognizer!.dispose();
        }
        if (_voskModel != null) {
          _voskModel!.dispose();
        }
        _voskPartialSubscription?.cancel();
        _voskResultSubscription?.cancel();
        _voskSpeechService = null;
        _voskRecognizer = null;
        _voskModel = null;
        _voskPartialSubscription = null;
        _voskResultSubscription = null;
      }
    } catch (e, stackTrace) {
      developer.log(
        'Error during synchronous cleanup attempt: $e',
        name: 'LocalTranscriptionProvider',
        error: e,
        stackTrace: stackTrace,
      );
    }

    await _saveSelectedModelType(newModelType);

    await _initializeSelectedModel(newModelType);

    _isLoading = false;
    notifyListeners();
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

  Future<void> _initializeSelectedModel(ModelType modelToInitialize) async {
    _isModelInitialized = false;
    _isTranscribing = false;
    _error = null;
    notifyListeners();

    try {
      bool initResult = false;

      if (modelToInitialize == ModelType.vosk) {
        final modelPath = await ModelLoader().loadFromAssets(
          'assets/models/vosk-model-small-en-us-0.15.zip',
        );
        _voskModel = await _voskPlugin.createModel(modelPath);
        if (_voskModel == null) {
          throw Exception("Failed to create Vosk model object");
        }
        _voskRecognizer = await _voskPlugin.createRecognizer(
          model: _voskModel!,
          sampleRate: 16000,
        );
        if (_voskRecognizer == null) {
          throw Exception("Failed to create Vosk recognizer");
        }

        if (Platform.isAndroid) {
          if (_voskSpeechService != null) {
          } else {
            try {
              _voskSpeechService = await _voskPlugin.initSpeechService(
                _voskRecognizer!,
              );
              initResult = _voskSpeechService != null;
              if (initResult) {
                _setupVoskListeners();
              } else {
                _error =
                    'Failed to initialize Vosk Speech Service (returned null).';
              }
            } catch (e, stackTrace) {
              _error =
                  'Failed to initialize Vosk Speech Service (exception): $e';
              developer.log(
                _error!,
                name: 'LocalTranscriptionProvider',
                error: e,
                stackTrace: stackTrace,
              );
              initResult = false;
            }
          }
        } else {
          initResult = true;
        }
      } else {
        if (modelToInitialize == ModelType.whisper) {
          _whisperService = WhisperFileService();
          initResult = await _whisperService!.initialize();

          if (!initResult) {
            _error = 'Failed to initialize Whisper service via plugin.';
            developer.log(_error!, name: 'LocalTranscriptionProvider');
          }
        } else {
          _error =
              'State Inconsistency: Tried to initialize Whisper when intended model was $modelToInitialize';
          developer.log(
            _error!,
            name: 'LocalTranscriptionProvider',
            level: 1000,
          );
          initResult = false;
        }
      }

      _isModelInitialized = initResult;
    } catch (e, stackTrace) {
      _error = 'Error initializing ${modelToInitialize.name} model: $e';
      developer.log(
        _error!,
        name: 'LocalTranscriptionProvider',
        error: e,
        stackTrace: stackTrace,
      );
      _isModelInitialized = false;
    } finally {
      notifyListeners();
    }
  }

  void _setupVoskListeners() {
    if (_voskSpeechService == null) return;
    _voskPartialSubscription?.cancel();
    _voskResultSubscription?.cancel();
    _voskPartialSubscription = _voskSpeechService!.onPartial().listen(
      (partialJson) {
        try {
          final data = jsonDecode(partialJson) as Map<String, dynamic>;
          final partial = data['partial'] as String? ?? '';
          if (partial.trim().isEmpty && _accumulatedText.isNotEmpty) return;
          _currentStreamingText =
              _accumulatedText.isEmpty ? partial : '$_accumulatedText $partial';
          notifyListeners();
        } catch (e) {
          developer.log(
            'Error parsing Vosk partial: $e, JSON: $partialJson',
            name: 'LocalTranscriptionProvider',
          );
        }
      },
      onError: (e) {
        developer.log(
          'Error in Vosk result stream: $e',
          name: 'LocalTranscriptionProvider',
        );
        _error = 'Vosk result stream error: $e';
        notifyListeners();
      },
    );

    _voskResultSubscription = _voskSpeechService!.onResult().listen(
      (resultJson) {
        try {
          final data = jsonDecode(resultJson) as Map<String, dynamic>;
          final text = data['text'] as String? ?? '';

          if (text.trim().isNotEmpty) {
            _accumulatedText =
                _accumulatedText.isEmpty ? text : '$_accumulatedText $text';
            _currentStreamingText = _accumulatedText;
            notifyListeners();
          }
        } catch (e) {
          developer.log(
            'Error parsing Vosk result: $e, JSON: $resultJson',
            name: 'LocalTranscriptionProvider',
          );
        }
      },
      onError: (e) {
        developer.log(
          'Error in Vosk result stream: $e',
          name: 'LocalTranscriptionProvider',
        );
        _error = 'Vosk result stream error: $e';
        notifyListeners();
      },
    );
  }

  Future<bool> startRecording() async {
    _error = null;
    if (!_isModelInitialized) {
      _error = 'Model not ready';
      notifyListeners();
      return false;
    }
    if (_isRecording) {
      return true;
    }

    bool success = false;
    try {
      if (_selectedModelType == ModelType.vosk) {
        if (_voskSpeechService == null) {
          throw Exception('Vosk SpeechService not initialized');
        }
        await _voskSpeechService!.start();
        success = true;
        _isStreaming = true;
        _accumulatedText = '';
        _currentStreamingText = '';
      } else {
        success = await _audioService.startRecording(useStreaming: false);
        if (!success) {
          _error = 'Failed to start audio recording for Whisper';
        }
      }

      if (success) {
        _isRecording = true;
      }
    } catch (e, stackTrace) {
      _error = 'Failed to start recording: $e';
      developer.log(
        _error!,
        name: 'LocalTranscriptionProvider',
        error: e,
        stackTrace: stackTrace,
      );
      success = false;
      _isRecording = false;
      _isStreaming = false;
    } finally {
      notifyListeners();
    }
    return success;
  }

  Future<void> stopRecordingAndSave() async {
    if (!_isRecording) return;

    _error = null;
    _isRecording = false;
    _isStreaming = false;
    _isTranscribing = true;
    notifyListeners();

    try {
      if (_selectedModelType == ModelType.vosk) {
        if (_voskSpeechService == null) {
          throw Exception('Vosk SpeechService not available');
        }

        await _voskSpeechService!.stop();

        final resultText = _accumulatedText.trim();

        if (resultText.isEmpty) {
          _error = 'No speech detected (Vosk)';
          developer.log(_error!, name: 'LocalTranscriptionProvider');
        } else {
          await _saveTranscription(resultText, '');
        }
        _accumulatedText = '';
        _currentStreamingText = '';
      } else {
        if (_whisperService == null) {
          throw Exception('Whisper service not available');
        }

        final audioFile = await _audioService.stopRecording();

        if (audioFile == null || !await audioFile.exists()) {
          _error = 'Failed to get recorded audio file for Whisper';
          developer.log(_error!, name: 'LocalTranscriptionProvider');
        } else {
          final fileSize = await audioFile.length();

          if (fileSize < 1000) {
            _error = 'Recording too short or empty for Whisper';
            developer.log(_error!, name: 'LocalTranscriptionProvider');
          } else {
            try {
              final transcriptionText = await _whisperService!.transcribeFile(
                audioFile.path,
              );

              if (transcriptionText == null ||
                  transcriptionText.trim().isEmpty) {
                _error = 'No speech detected (Whisper)';
                developer.log(_error!, name: 'LocalTranscriptionProvider');
              } else {
                final storedAudioPath = await _storageService.saveAudioFile(
                  audioFile,
                  'whisper_${_uuid.v4()}.m4a',
                );
                await _saveTranscription(transcriptionText, storedAudioPath);
              }
            } catch (e, stackTrace) {
              _error = 'Whisper transcription failed: $e';
              developer.log(
                _error!,
                name: 'LocalTranscriptionProvider',
                error: e,
                stackTrace: stackTrace,
              );
            } finally {
              try {
                await audioFile.delete();
              } catch (_) {}
            }
          }
        }
      }
    } catch (e, stackTrace) {
      _error = 'Error stopping/saving transcription: $e';
      developer.log(
        _error!,
        name: 'LocalTranscriptionProvider',
        error: e,
        stackTrace: stackTrace,
      );
    } finally {
      _isRecording = false;
      _isStreaming = false;
      _isTranscribing = false;
      notifyListeners();
    }
  }

  Future<void> _saveTranscription(String text, String audioPath) async {
    try {
      final formattedText = _formatTranscriptionText(text);
      final transcription = Transcription(
        id: _uuid.v4(),
        sessionId: _activeSessionId,
        text: formattedText,
        timestamp: DateTime.now(),
        audioPath: audioPath,
      );
      await _storageService.saveTranscription(transcription);
      await _loadTranscriptions();
    } catch (e, stackTrace) {
      developer.log(
        'Error saving transcription: $e',
        name: 'LocalTranscriptionProvider',
        error: e,
        stackTrace: stackTrace,
      );
      _error = 'Failed to save transcription results';
    }
  }

  String _formatTranscriptionText(String text) {
    if (text.isEmpty) return text;

    String normalizedText = text.trim().replaceAll(RegExp(r'\s+'), ' ');

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

    final bulletRegex = RegExp(r'(?:^|\n|\s)(?:[•\-\*]|\d+\.)\s');
    if (bulletRegex.hasMatch(normalizedText)) {
      normalizedText = normalizedText.replaceAllMapped(
        RegExp(r'(?<!\n)(?<!\n\s)(?<!\n\n)(\s*)(?:[•\-\*]|\d+\.)\s'),
        (match) => '\n${match.group(1)}${match.group(0)}',
      );

      normalizedText = normalizedText.replaceAll(RegExp(r'\n\n+'), '\n\n');

      return normalizedText;
    }

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

    final List<String> paragraphs = [];
    for (int i = 0; i < sentences.length; i += 3) {
      final int end = i + 3 < sentences.length ? i + 3 : sentences.length;
      final paragraph = sentences.sublist(i, end).join(' ');
      paragraphs.add(paragraph);
    }

    return paragraphs.join('\n\n');
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
        sessionId: transcription.sessionId,
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

  Future<void> _loadSessions() async {
    final prefs = await SharedPreferences.getInstance();
    final sessionsJson = prefs.getString(_prefsKeySessions);
    if (sessionsJson != null) {
      final List<dynamic> list = jsonDecode(sessionsJson);
      _sessions = list.map((m) => Session.fromJson(m)).toList();
    } else {
      _sessions = [
        Session(
          id: 'default_session',
          name: 'Default',
          timestamp: DateTime.now(),
        ),
      ];
      await _saveSessions();
    }
    final active = prefs.getString(_prefsKeyActiveSession);
    if (active != null && _sessions.any((s) => s.id == active)) {
      _activeSessionId = active;
    } else {
      _activeSessionId = _sessions.first.id;
      await _saveActiveSession();
    }
  }

  Future<void> _saveSessions() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _prefsKeySessions,
      jsonEncode(_sessions.map((s) => s.toJson()).toList()),
    );
  }

  Future<void> _saveActiveSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKeyActiveSession, _activeSessionId);
  }

  Future<void> createSession(String name) async {
    final session = Session(
      id: _uuid.v4(),
      name: name,
      timestamp: DateTime.now(),
    );
    _sessions.add(session);
    notifyListeners();
    await _saveSessions();
  }

  Future<void> renameSession(String id, String newName) async {
    final idx = _sessions.indexWhere((s) => s.id == id);
    if (idx >= 0) {
      _sessions[idx].name = newName;
      notifyListeners();
      await _saveSessions();
    }
  }

  Future<void> switchSession(String id) async {
    if (_sessions.any((s) => s.id == id)) {
      _activeSessionId = id;
      notifyListeners();
      await _saveActiveSession();
    }
  }

  Future<void> deleteSession(String id) async {
    if (_sessions.length <= 1) return;
    _sessions.removeWhere((s) => s.id == id);
    _transcriptions = _transcriptions.where((t) => t.sessionId != id).toList();
    await _saveSessions();
    if (_activeSessionId == id) {
      _activeSessionId = _sessions.first.id;
      await _saveActiveSession();
    }
    await _storageService.clearTranscriptions();
    for (final t in _transcriptions) {
      await _storageService.saveTranscription(t);
    }
    notifyListeners();
  }

  Future<void> clearTranscriptionsForSession(String sessionId) async {
    final remaining =
        _transcriptions.where((t) => t.sessionId != sessionId).toList();
    _transcriptions = remaining;
    await _storageService.clearTranscriptions();
    for (final t in remaining) {
      await _storageService.saveTranscription(t);
    }
    notifyListeners();
  }

  @override
  void dispose() {
    _voskPartialSubscription?.cancel();
    _voskResultSubscription?.cancel();
    _voskSpeechService?.stop();
    _whisperService?.dispose();
    _audioService.dispose();
    super.dispose();
  }
}
