import 'package:flutter/foundation.dart';
import 'dart:async';

import '../models/transcription.dart';
import '../models/model_type.dart';
import '../models/spoken_language.dart';
import 'session_provider.dart';
import 'transcription_state_manager.dart';
import 'model_management_provider.dart';
import 'transcription_ui_state_provider.dart';
import 'transcription_operation_provider.dart';
import 'transcription_data_provider.dart';
import '../services/audio_service.dart';
import '../logger.dart';

/// LocalTranscriptionProvider using composition of specialized providers
class LocalTranscriptionProvider with ChangeNotifier {
  late final TranscriptionStateManager _stateManager;
  late final ModelManagementProvider _modelManager;
  late final TranscriptionUIStateProvider _uiStateProvider;
  late final TranscriptionOperationProvider _operationProvider;
  late final TranscriptionDataProvider _dataProvider;

  final SessionProvider _sessionProvider;

  bool _isOperationLocked = false;
  DateTime? _lastOperationTime;
  final Set<String> _activeOperations = {};

  double _audioLevel = 0.0;
  double get audioLevel => _audioLevel;
  void updateAudioLevel(double level) {
    _audioLevel = level;
    notifyListeners();
  }

  final AudioService _audioService = AudioService();
  StreamSubscription<double>? _audioLevelSub;

  static const Duration _minimumOperationInterval = Duration(milliseconds: 500);
  static const Duration _operationTimeout = Duration(seconds: 30);

  /// Constructor initializes all specialized providers
  LocalTranscriptionProvider(this._sessionProvider) {
    _initializeProviders();
    _setupProviderCommunication();
    _initialize();
  }

  /// Initialize all specialized providers
  void _initializeProviders() {
    _stateManager = TranscriptionStateManager();
    _modelManager = ModelManagementProvider(_audioService);
    _uiStateProvider = TranscriptionUIStateProvider();
    _operationProvider = TranscriptionOperationProvider(_sessionProvider);
    _dataProvider = TranscriptionDataProvider(_sessionProvider);
  }

  /// Setup communication between providers
  void _setupProviderCommunication() {
    _sessionProvider.addListener(_onSessionChanged);

    _operationProvider.setPartialTranscriptionCallback(_onPartialTranscription);

    _stateManager.addListener(notifyListeners);
    _modelManager.addListener(notifyListeners);
    _uiStateProvider.addListener(notifyListeners);
    _operationProvider.addListener(notifyListeners);
    _dataProvider.addListener(notifyListeners);
  }

  /// Acquires operation lock to prevent concurrent operations
  Future<bool> _acquireOperationLock(String operationName) async {
    if (_isOperationLocked) {
      if (operationName == 'stopRecordingAndSave' &&
          _stateManager.isRecording) {
        return true;
      }

      return false;
    }

    if (operationName != 'stopRecordingAndSave') {
      final now = DateTime.now();
      if (_lastOperationTime != null) {
        final timeSinceLastOperation = now.difference(_lastOperationTime!);
        if (timeSinceLastOperation < _minimumOperationInterval) {
          return false;
        }
      }
    }

    if (!_modelManager.isInitialized && operationName != 'initialization') {
      return false;
    }

    if (_modelManager.isOperationInProgress &&
        operationName != 'stopRecordingAndSave') {
      return false;
    }

    _isOperationLocked = true;
    _lastOperationTime = DateTime.now();
    _activeOperations.add(operationName);

    Timer(_operationTimeout, () {
      if (_activeOperations.contains(operationName)) {
        _releaseOperationLock(operationName);
      }
    });

    return true;
  }

  /// Releases operation lock
  void _releaseOperationLock(String operationName) {
    _isOperationLocked = false;
    _activeOperations.remove(operationName);
  }

  /// Handles partial transcription updates during recording
  void _onPartialTranscription(String partial) {
    _uiStateProvider.updateStreamingText(partial);

    final isVosk = _modelManager.selectedModelType == ModelType.vosk;
    final isWhisperRT =
        _modelManager.selectedModelType == ModelType.whisper &&
        _modelManager.whisperRealtime;

    if ((isVosk || isWhisperRT) && _stateManager.isRecording) {
      final sessionId =
          _uiStateProvider.recordingSessionId ??
          _sessionProvider.activeSessionId;

      // For real-time models (Vosk or Whisper RT), use live preview during recording
      if (isVosk) {
        _uiStateProvider.updateLivePreview(partial, sessionId);
        _uiStateProvider.clearWhisperLoadingPreview();
      } else if (isWhisperRT) {
        _uiStateProvider.updateLivePreview(partial, sessionId);
        _uiStateProvider.clearWhisperLoadingPreview();
      }

      _uiStateProvider.updatePreviewForRecording(
        _modelManager.selectedModelType,
        partial,
        sessionId,
        true,
      );
    }
  }

  void _onSessionChanged() async {
    final validSessionIds = _sessionProvider.sessions.map((s) => s.id).toSet();
    final incognitoSession = _sessionProvider.findSessionById(
      _sessionProvider.activeSessionId,
    );
    if (incognitoSession != null && incognitoSession.isIncognito) {
      validSessionIds.add(incognitoSession.id);
    }
    await _dataProvider.cleanupDeletedSessions(validSessionIds);

    if (_uiStateProvider.recordingSessionId != null &&
        _uiStateProvider.recordingSessionId !=
            _sessionProvider.activeSessionId) {
      _uiStateProvider.cleanupPreviewsForSessionChange(
        _sessionProvider.activeSessionId,
      );
    }

    notifyListeners();
  }

  /// Initialize the provider system
  Future<void> _initialize() async {
    const operationName = 'initialization';

    if (!await _acquireOperationLock(operationName)) {
      _stateManager.setError('System is busy. Please wait and try again.');
      return;
    }

    _stateManager.transitionTo(TranscriptionState.loading);

    try {
      await _dataProvider.loadTranscriptions();

      await _modelManager.loadSelectedModelType();

      final bool isFileBasedWhisper =
          _modelManager.selectedModelType == ModelType.whisper &&
          !_modelManager.whisperRealtime;

      if (isFileBasedWhisper) {
        _modelManager.markAsInitializedForFileBased();
      } else {
        final error = await _modelManager.initializeSelectedModel();
        if (error != null) {
          _stateManager.setError(error);
          return;
        }
      }

      _operationProvider.initializeOrchestrator(_modelManager.orchestrator);

      _stateManager.transitionTo(TranscriptionState.ready);
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.provider,
        message: 'Failed to initialize transcription system',
      );
      _stateManager.setError('Failed to initialize transcription system: $e');
    } finally {
      _releaseOperationLock(operationName);
    }
  }

  // ============================================================================
  // PUBLIC API - State getters
  // ============================================================================

  TranscriptionState get state => _stateManager.state;
  bool get isLoading => _stateManager.isLoading;
  bool get isModelReady => _stateManager.isModelReady;
  bool get isRecording => _stateManager.isRecording;
  bool get isTranscribing => _stateManager.isTranscribing;
  bool get isStreaming => _stateManager.isStreaming;
  String? get error => _stateManager.error;

  ModelType get selectedModelType => _modelManager.selectedModelType;
  bool get isInitializing => _modelManager.isInitializing;
  String? get initializationStatus => _modelManager.initializationStatus;

  String get currentStreamingText => _uiStateProvider.currentStreamingText;
  Transcription? get liveVoskTranscriptionPreview =>
      _uiStateProvider.getLiveVoskTranscriptionPreviewForSession(
        _sessionProvider.activeSessionId,
      );
  Transcription? get loadingWhisperTranscriptionPreview =>
      _uiStateProvider.getLoadingWhisperTranscriptionPreviewForSession(
        _sessionProvider.activeSessionId,
      );

  List<Transcription> get transcriptions => _dataProvider.transcriptions;
  List<Transcription> get allTranscriptions => _dataProvider.allTranscriptions;
  List<Transcription> get sessionTranscriptions =>
      _dataProvider.sessionTranscriptions;

  bool get isOperationInProgress =>
      _isOperationLocked || _modelManager.isOperationInProgress;

  bool get whisperRealtime => _modelManager.whisperRealtime;

  SpokenLanguage get selectedLanguage => _modelManager.selectedLanguage;
  bool get isLanguageSelectionAvailable =>
      _modelManager.isLanguageSelectionAvailable;

  /// Sets the selected spoken language
  Future<void> setSelectedLanguage(SpokenLanguage language) async {
    await _modelManager.setSelectedLanguage(language);
  }

  // ============================================================================
  // PUBLIC API - Operations
  // ============================================================================

  /// Changes the transcription model
  Future<void> changeModel(ModelType newModelType) async {
    const operationName = 'changeModel';

    if (!await _acquireOperationLock(operationName)) {
      _stateManager.setError('Cannot change model - system is busy');
      return;
    }

    if (!_stateManager.transitionTo(TranscriptionState.loading)) {
      _releaseOperationLock(operationName);
      return;
    }

    try {
      final error = await _modelManager.changeModel(newModelType);

      if (error != null) {
        _stateManager.setError(error);
      } else {
        _operationProvider.initializeOrchestrator(_modelManager.orchestrator);
        _stateManager.transitionTo(TranscriptionState.ready);
      }
    } finally {
      _releaseOperationLock(operationName);
    }
  }

  /// Starts recording
  Future<bool> startRecording() async {
    const operationName = 'startRecording';

    final bool isRealtime =
        _modelManager.selectedModelType == ModelType.vosk ||
        (_modelManager.selectedModelType == ModelType.whisper &&
            _modelManager.whisperRealtime);

    if (isRealtime && !_modelManager.isInitialized) {
      _stateManager.setError(
        'Model not ready. Please restart the app or switch to Whisper (file-based) model.',
      );
      return false;
    }

    if (!await _acquireOperationLock(operationName)) {
      return false;
    }

    final currentState = _stateManager.state;
    if (currentState != TranscriptionState.ready && 
        currentState != TranscriptionState.error) {
      _releaseOperationLock(operationName);
      return false;
    }

    if (currentState == TranscriptionState.error) {
      if (!_stateManager.transitionTo(TranscriptionState.ready)) {
        logger.error(
          'Failed to transition from error to ready',
          flag: FeatureFlag.provider,
        );
        _releaseOperationLock(operationName);
        return false;
      }
    }

    if (!_stateManager.transitionTo(TranscriptionState.recording)) {
      _releaseOperationLock(operationName);
      return false;
    }

    final sessionId = _sessionProvider.activeSessionId;
    _uiStateProvider.setRecordingSessionId(sessionId);

    try {
      _audioLevelSub?.cancel();
      final success = await _operationProvider.startRecording(
        _modelManager.selectedModelType,
        sessionId,
        _modelManager.whisperRealtime,
        languageCode: _modelManager.isLanguageSelectionAvailable
            ? _modelManager.selectedLanguage.code
            : null,
      );

      if (!success) {
        _stateManager.setError('Failed to start recording');
        _uiStateProvider.clearRecordingSessionId();
        return false;
      }

      _audioLevelSub = _audioService.audioLevelStream.listen(updateAudioLevel);

      final isLivePreview =
          _modelManager.selectedModelType == ModelType.vosk ||
          (_modelManager.selectedModelType == ModelType.whisper &&
              _modelManager.whisperRealtime);
      if (isLivePreview) {
        _uiStateProvider.clearLivePreview();
      } else {
        _uiStateProvider.clearWhisperLoadingPreview();
      }

      return true;
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.provider,
        message: 'Error starting recording',
      );
      
      final errorMessage = e.toString();
      if (errorMessage.contains('permission') && errorMessage.toLowerCase().contains('denied')) {
        if (errorMessage.contains('Settings')) {
          _stateManager.setError('Microphone access denied. Please enable it in Settings.');
        } else if (errorMessage.contains('permanently denied')) {
          _stateManager.setError('Microphone access denied. Please enable it in Settings.');
        } else {
          _stateManager.setError('Microphone permission required. Please tap the button again to grant access.');
        }
      } else {
        _stateManager.setError('Error starting recording: $e');
      }
      
      _uiStateProvider.clearRecordingSessionId();
      return false;
    } finally {
      _releaseOperationLock(operationName);
    }
  }

  /// Stops recording and saves transcription
  Future<void> stopRecordingAndSave() async {
    const operationName = 'stopRecordingAndSave';

    if (!_stateManager.isRecording) {
      return;
    }

    if (!await _acquireOperationLock(operationName)) {
      _stateManager.setError('Cannot stop recording - system is busy');
      return;
    }

    if (!_stateManager.transitionTo(TranscriptionState.transcribing)) {
      _releaseOperationLock(operationName);
      return;
    }

    final modelType = _modelManager.selectedModelType;
    final sessionId =
        _uiStateProvider.recordingSessionId ?? _sessionProvider.activeSessionId;

    if (modelType == ModelType.whisper && !_modelManager.whisperRealtime) {
      _uiStateProvider.createWhisperLoadingPreview(sessionId);
    }

    try {
      final result = await _operationProvider.stopRecordingAndTranscribe(
        modelType,
        sessionId,
        _modelManager.whisperRealtime,
        languageCode: _modelManager.isLanguageSelectionAvailable
            ? _modelManager.selectedLanguage.code
            : null,
      );

      final isLivePreview =
          modelType == ModelType.vosk ||
          (modelType == ModelType.whisper && _modelManager.whisperRealtime);
      if (isLivePreview) {
        _uiStateProvider.clearLivePreview();
      } else {
        _uiStateProvider.clearWhisperLoadingPreview();
      }

      if (result.isSuccess) {
        if (result.transcription != null &&
            result.transcription!.text.trim().isNotEmpty) {
          _dataProvider.addTranscription(result.transcription!);
        }
        _stateManager.transitionTo(TranscriptionState.ready);
      } else {
        final errorMessage = result.errorMessage ?? 'Unknown error';
        _stateManager.setError(errorMessage);
      }
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.provider,
        message: 'Error stopping recording',
      );
      _stateManager.setError('Error stopping recording: $e');

      _uiStateProvider.clearLivePreview();
      _uiStateProvider.clearWhisperLoadingPreview();
    } finally {
      _uiStateProvider.clearRecordingSessionId();
      _audioLevelSub?.cancel();
      _audioLevelSub = null;
      _releaseOperationLock(operationName);
    }
  }

  /// Reinitializes the model (for error recovery)
  Future<void> reinitializeModel() async {
    const operationName = 'reinitializeModel';

    if (!await _acquireOperationLock(operationName)) {
      return;
    }

    try {
      _stateManager.transitionTo(TranscriptionState.loading);

      final error = await _modelManager.initializeSelectedModel();

      if (error != null) {
        _stateManager.setError(error);
      } else {
        _operationProvider.initializeOrchestrator(_modelManager.orchestrator);
        _stateManager.transitionTo(TranscriptionState.ready);
      }
    } finally {
      _releaseOperationLock(operationName);
    }
  }

  /// Resets to ready state (for error recovery)
  void resetToReadyState() {
    if (_stateManager.state == TranscriptionState.error) {
      _stateManager.transitionTo(TranscriptionState.ready);
    }
  }

  /// Forces system reset to clear any stuck states
  Future<void> forceSystemReset() async {
    _isOperationLocked = false;
    _activeOperations.clear();
    _lastOperationTime = null;

    _uiStateProvider.clearRecordingSessionId();
    _uiStateProvider.clearLivePreview();
    _uiStateProvider.clearWhisperLoadingPreview();

    await _modelManager.forceReinitialize();

    _stateManager.transitionTo(TranscriptionState.ready);
  }

  // ============================================================================
  // PUBLIC API - Data operations
  // ============================================================================

  Future<void> loadTranscriptions() => _dataProvider.loadTranscriptions();

  Future<void> deleteTranscription(String id) =>
      _dataProvider.deleteTranscription(id);

  Future<void> deleteTranscriptions(Set<String> ids) =>
      _dataProvider.deleteTranscriptions(ids);

  Future<void> clearTranscriptions() => _dataProvider.clearTranscriptions();

  Future<void> deleteParagraphFromTranscription(
    String id,
    int paragraphIndex,
  ) => _dataProvider.deleteParagraphFromTranscription(id, paragraphIndex);

  Future<void> clearTranscriptionsForSession(String sessionId) =>
      _dataProvider.clearTranscriptionsForSession(sessionId);

  Future<void> deleteAllTranscriptionsForSession(String sessionId) =>
      _dataProvider.deleteAllTranscriptionsForSession(sessionId);

  Future<void> setWhisperRealtime(bool value) async {
    await _modelManager.setWhisperRealtime(value);
  }

  void updateTranscription(Transcription updated) {
    _dataProvider.updateTranscription(updated);
    notifyListeners();
  }

  @override
  void dispose() {
    _audioLevelSub?.cancel();
    _audioService.dispose();
    _sessionProvider.removeListener(_onSessionChanged);
    _stateManager.dispose();
    _modelManager.dispose();
    _uiStateProvider.dispose();
    _operationProvider.dispose();
    _dataProvider.dispose();
    super.dispose();
  }
}

