import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import '../models/transcription.dart';
import '../repositories/transcription_repository.dart';
import '../services/vosk_service.dart';
import '../services/whisper_service.dart';
import '../services/audio_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:developer' as developer;
import 'dart:async';
import 'dart:io';
import 'session_provider.dart';
import '../utils/transcription_formatter.dart';
import '../managers/session_transcription_manager.dart';
import '../managers/transcription_orchestrator.dart';
import '../models/model_type.dart';

enum TranscriptionState { loading, ready, recording, transcribing, error }

class LocalTranscriptionProvider with ChangeNotifier {
  final TranscriptionRepository _repository = TranscriptionRepository();
  late final SessionTranscriptionManager _sessionManager;
  final AudioService _audioService = AudioService();
  final VoskService _voskService = VoskService();
  WhisperService? _whisperService;
  final Uuid _uuid = const Uuid();
  final SessionProvider sessionProvider;
  List<Transcription> _transcriptions = [];
  TranscriptionState _state = TranscriptionState.loading;
  String? _errorMessage;
  String _currentStreamingText = '';
  Transcription? _liveVoskTranscriptionPreview;
  Transcription? _loadingWhisperTranscriptionPreview;
  late TranscriptionOrchestrator _orchestrator;
  ModelType _selectedModelType = ModelType.vosk;
  static const String _prefsKeyModelType = 'selected_model_type';

  List<Transcription> get transcriptions => _transcriptions;
  TranscriptionState get state => _state;
  bool get isLoading => _state == TranscriptionState.loading;
  bool get isModelReady => _state == TranscriptionState.ready;
  bool get isRecording => _state == TranscriptionState.recording;
  bool get isTranscribing => _state == TranscriptionState.transcribing;
  bool get isStreaming => _state == TranscriptionState.recording;
  String? get error =>
      _state == TranscriptionState.error ? _errorMessage : null;
  String get currentStreamingText => _currentStreamingText;
  ModelType get selectedModelType => _selectedModelType;
  List<Transcription> get allTranscriptions => _transcriptions;
  Transcription? get liveVoskTranscriptionPreview =>
      _liveVoskTranscriptionPreview;
  Transcription? get loadingWhisperTranscriptionPreview =>
      _loadingWhisperTranscriptionPreview;

  List<Transcription> get sessionTranscriptions => _sessionManager
      .filterBySession(_transcriptions, sessionProvider.activeSessionId);

  LocalTranscriptionProvider(this.sessionProvider) {
    _sessionManager = SessionTranscriptionManager(_repository);
    sessionProvider.addListener(_onSessionChanged);
    _initialize();
  }

  void _onSessionChanged() async {
    // Get all session IDs currently in the in-memory _transcriptions list
    final inMemorySessionIds = _transcriptions.map((t) => t.sessionId).toSet();

    // Get all valid session IDs from SessionProvider
    final validSessionIds = sessionProvider.sessions.map((s) => s.id).toSet();

    // Find session IDs that are in memory but no longer valid
    final sessionsToDelete = inMemorySessionIds.difference(validSessionIds);

    bool changed = false;
    if (sessionsToDelete.isNotEmpty) {
      for (final sessionIdToDelete in sessionsToDelete) {
        if (sessionIdToDelete.isEmpty) continue;
        await _repository.deleteTranscriptionsForSession(sessionIdToDelete);
        _transcriptions.removeWhere((t) => t.sessionId == sessionIdToDelete);
      }
      changed = true;
    }

    if (changed) {
      notifyListeners();
    } else {
      notifyListeners();
    }
  }

  Future<void> _initialize() async {
    _state = TranscriptionState.loading;
    notifyListeners();
    await _loadTranscriptions();
    await _loadSelectedModelType();
    await _initializeSelectedModel(_selectedModelType);
    _state = TranscriptionState.ready;
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
    if (_selectedModelType == newModelType &&
        _state == TranscriptionState.ready) {
      return;
    }

    _state = TranscriptionState.loading;
    _errorMessage = null;
    ModelType previousModelType = _selectedModelType;
    _selectedModelType = newModelType;
    notifyListeners();

    try {
      if (previousModelType == ModelType.whisper) {
        await _whisperService?.dispose();
        _whisperService = null;
      } else if (previousModelType == ModelType.vosk) {
        await _voskService.stop();
        await _voskService.dispose();
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

    _state =
        _errorMessage != null
            ? TranscriptionState.error
            : TranscriptionState.ready;
    notifyListeners();
  }

  Future<void> _loadTranscriptions() async {
    try {
      _transcriptions = await _repository.getTranscriptions();
      _transcriptions.sort((a, b) => a.timestamp.compareTo(b.timestamp));
      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to load transcriptions';
      developer.log(
        _errorMessage!,
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
    _state = TranscriptionState.loading;
    _errorMessage = null;
    notifyListeners();

    try {
      bool initResult = false;

      if (modelToInitialize == ModelType.vosk) {
        final initialized = await _voskService.initialize(
          'assets/models/vosk-model-small-en-us-0.15.zip',
        );
        if (initialized) {
          initResult = true;
        } else {
          _errorMessage = 'Failed to initialize Vosk service.';
        }
      } else {
        if (modelToInitialize == ModelType.whisper) {
          _whisperService = WhisperService();
          initResult = await _whisperService!.initialize();

          if (!initResult) {
            _errorMessage = 'Failed to initialize Whisper service via plugin.';
            developer.log(_errorMessage!, name: 'LocalTranscriptionProvider');
          }
        } else {
          _errorMessage =
              'State Inconsistency: Tried to initialize Whisper when intended model was $modelToInitialize';
          developer.log(
            _errorMessage!,
            name: 'LocalTranscriptionProvider',
            level: 1000,
          );
          initResult = false;
        }
      }

      _state = initResult ? TranscriptionState.ready : TranscriptionState.error;

      _orchestrator = TranscriptionOrchestrator(
        _audioService,
        _voskService,
        _whisperService,
      );
      _orchestrator.onPartial.listen((partial) {
        _currentStreamingText = partial;
        _state =
            _selectedModelType == ModelType.vosk
                ? TranscriptionState.recording
                : TranscriptionState.transcribing;

        if (_selectedModelType == ModelType.vosk && isRecording) {
          _liveVoskTranscriptionPreview = Transcription(
            id: 'live_vosk_active_preview',
            text: _currentStreamingText,
            timestamp: DateTime.now(),
            sessionId: sessionProvider.activeSessionId,
            audioPath: '',
          );
        } else {
          _liveVoskTranscriptionPreview = null;
        }
        notifyListeners();
      });
    } catch (e, stackTrace) {
      _errorMessage = 'Error initializing ${modelToInitialize.name} model: $e';
      developer.log(
        _errorMessage!,
        name: 'LocalTranscriptionProvider',
        error: e,
        stackTrace: stackTrace,
      );
      _state = TranscriptionState.error;
    } finally {
      notifyListeners();
    }
  }

  Future<bool> startRecording() async {
    _errorMessage = null;
    if (_state != TranscriptionState.ready) {
      _errorMessage = 'Model not ready';
      _state = TranscriptionState.error;
      notifyListeners();
      return false;
    }

    bool success = false;
    try {
      success = await _orchestrator.startRecording(_selectedModelType);
      if (!success && _selectedModelType == ModelType.whisper) {
        _errorMessage = 'Failed to start audio recording for Whisper';
      }
      if (success) {
        _state = TranscriptionState.recording;
        if (_selectedModelType == ModelType.vosk) {
          _liveVoskTranscriptionPreview = Transcription(
            id: 'live_vosk_active_preview',
            text: '',
            timestamp: DateTime.now(),
            sessionId: sessionProvider.activeSessionId,
            audioPath: '',
          );
          _loadingWhisperTranscriptionPreview = null;
        } else if (_selectedModelType == ModelType.whisper) {
          _liveVoskTranscriptionPreview = null;
          _loadingWhisperTranscriptionPreview = null;
        }
      }
    } catch (e, stack) {
      _errorMessage = 'Failed to start recording: $e';
      developer.log(
        _errorMessage!,
        name: 'LocalTranscriptionProvider',
        error: e,
        stackTrace: stack,
      );
      success = false;
      _state = TranscriptionState.error;
    } finally {
      notifyListeners();
    }
    return success;
  }

  Future<void> stopRecordingAndSave() async {
    if (_state != TranscriptionState.recording &&
        _state != TranscriptionState.transcribing) {
      return;
    }

    _errorMessage = null;
    bool wasVoskRecording =
        _selectedModelType == ModelType.vosk &&
        _state == TranscriptionState.recording;
    ModelType modelUsedForThisOperation = _selectedModelType;

    _state = TranscriptionState.transcribing;
    if (modelUsedForThisOperation == ModelType.whisper) {
      _loadingWhisperTranscriptionPreview = Transcription(
        id: 'whisper_loading_active_preview',
        text: '',
        timestamp: DateTime.now(),
        sessionId: sessionProvider.activeSessionId,
        audioPath: '',
      );
    }
    notifyListeners();

    try {
      final output = await _orchestrator.stopRecording(
        modelUsedForThisOperation,
      );
      final resultText = output.text;

      if (wasVoskRecording) {
        _liveVoskTranscriptionPreview = null;
      }

      if (resultText.isEmpty) {
        final modelName =
            modelUsedForThisOperation == ModelType.vosk ? 'Vosk' : 'Whisper';
        _errorMessage = 'No speech detected ($modelName)';
        developer.log(_errorMessage!, name: 'LocalTranscriptionProvider');
        if (modelUsedForThisOperation == ModelType.whisper) {
          _loadingWhisperTranscriptionPreview = null;
        }
      } else {
        String audioPath = '';
        if (modelUsedForThisOperation == ModelType.whisper) {
          final tempFile = File(output.audioPath);
          if (await tempFile.exists()) {
            audioPath = await _repository.saveAudioFile(
              tempFile,
              'whisper_${_uuid.v4()}.m4a',
            );
            try {
              await tempFile.delete();
            } catch (_) {}
          }
        }
        await _saveTranscription(resultText, audioPath);
        if (modelUsedForThisOperation == ModelType.whisper) {
          _loadingWhisperTranscriptionPreview = null;
        }
      }
    } catch (e, stack) {
      _errorMessage = 'Error stopping/saving transcription: $e';
      developer.log(
        _errorMessage!,
        name: 'LocalTranscriptionProvider',
        error: e,
        stackTrace: stack,
      );
      if (modelUsedForThisOperation == ModelType.vosk) {
        _liveVoskTranscriptionPreview = null;
      }
      if (modelUsedForThisOperation == ModelType.whisper) {
        _loadingWhisperTranscriptionPreview = null;
      }
    } finally {
      if (_state != TranscriptionState.error) {
        _state = TranscriptionState.ready;
      }
      notifyListeners();
    }
  }

  Future<void> _saveTranscription(String text, String audioPath) async {
    try {
      final sessionId = sessionProvider.activeSessionId;
      final formattedText = TranscriptionFormatter.format(text);
      final transcription = Transcription(
        id: _uuid.v4(),
        sessionId: sessionId,
        text: formattedText,
        timestamp: DateTime.now(),
        audioPath: audioPath,
      );
      await _repository.saveTranscription(transcription);

      await sessionProvider.updateSessionModifiedTimestamp(sessionId);

      await _loadTranscriptions();
    } catch (e, stackTrace) {
      developer.log(
        'Error saving transcription: $e',
        name: 'LocalTranscriptionProvider',
        error: e,
        stackTrace: stackTrace,
      );
      _errorMessage = 'Failed to save transcription results';
    }
  }

  Future<void> deleteTranscription(String id) async {
    _errorMessage = null;
    try {
      final transcription = _transcriptions.firstWhere((t) => t.id == id);
      final sessionId = transcription.sessionId;

      await _repository.deleteTranscription(id);
      _transcriptions.removeWhere((t) => t.id == id);

      await sessionProvider.updateSessionModifiedTimestamp(sessionId);
      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to delete transcription';
      developer.log(
        _errorMessage!,
        name: 'LocalTranscriptionProvider',
        error: e,
      );
      throw Exception('Failed to delete transcription: $e');
    }
  }

  Future<void> deleteTranscriptions(Set<String> ids) async {
    _errorMessage = null;
    try {
      final sessionIds = <String>{};

      for (final id in ids) {
        final transcription = _transcriptions.firstWhere((t) => t.id == id);
        sessionIds.add(transcription.sessionId);
        await _repository.deleteTranscription(id);
      }

      _transcriptions.removeWhere((t) => ids.contains(t.id));

      for (final sessionId in sessionIds) {
        await sessionProvider.updateSessionModifiedTimestamp(sessionId);
      }

      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to delete transcriptions';
      developer.log(
        _errorMessage!,
        name: 'LocalTranscriptionProvider',
        error: e,
      );
      throw Exception('Failed to delete transcriptions: $e');
    }
  }

  Future<void> clearTranscriptions() async {
    _errorMessage = null;
    try {
      await _repository.clearTranscriptions();
      await _loadTranscriptions();
    } catch (e) {
      _errorMessage = 'Failed to clear transcriptions';
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
    try {
      final transcription = _transcriptions.firstWhere((t) => t.id == id);
      final sessionId = transcription.sessionId;

      final updatedList = await _sessionManager.deleteParagraph(
        id,
        paragraphIndex,
      );
      _transcriptions = updatedList;

      await sessionProvider.updateSessionModifiedTimestamp(sessionId);

      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to delete paragraph';
      developer.log(
        'Error deleting paragraph: $e',
        name: 'LocalTranscriptionProvider',
        error: e,
      );
      notifyListeners();
    }
  }

  Future<void> clearTranscriptionsForSession(String sessionId) async {
    try {
      final remaining = await _sessionManager.clearSession(sessionId);
      _transcriptions = remaining;

      await sessionProvider.updateSessionModifiedTimestamp(sessionId);

      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to clear session transcriptions';
      developer.log(
        'Error clearing session transcriptions: $e',
        name: 'LocalTranscriptionProvider',
        error: e,
      );
      notifyListeners();
    }
  }

  /// Loads transcriptions for a specific session
  /// This is used when navigating to a session screen
  Future<void> loadTranscriptionsForSession(String sessionId) async {
    try {
      final allTranscriptions = await _repository.getTranscriptions();
      _transcriptions =
          allTranscriptions.where((t) => t.sessionId == sessionId).toList();
      _transcriptions.sort((a, b) => a.timestamp.compareTo(b.timestamp));

      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to load transcriptions for session';
      developer.log(
        _errorMessage!,
        name: 'LocalTranscriptionProvider',
        error: e,
      );
      notifyListeners();
    }
  }

  Future<void> deleteAllTranscriptionsForSession(String sessionId) async {
    _transcriptions.removeWhere((t) => t.sessionId == sessionId);
    await _repository.deleteTranscriptionsForSession(sessionId);
    notifyListeners();
  }

  @override
  void dispose() {
    sessionProvider.removeListener(_onSessionChanged);
    _orchestrator.dispose();
    super.dispose();
  }
}
