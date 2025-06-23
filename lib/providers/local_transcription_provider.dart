import 'package:flutter/foundation.dart';
import 'dart:developer' as developer;
import 'dart:async';

import '../models/transcription.dart';
import '../models/model_type.dart';
import 'session_provider.dart';
import 'transcription_state_manager.dart';
import 'model_management_provider.dart';
import 'transcription_ui_state_provider.dart';
import 'transcription_operation_provider.dart';
import 'transcription_data_provider.dart';

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
    _modelManager = ModelManagementProvider();
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
        developer.log(
          'Allowing stop operation to proceed despite lock - recording in progress',
          name: 'LocalTranscriptionProvider',
        );
        return true;
      }

      developer.log(
        'Operation "$operationName" rejected - another operation in progress',
        name: 'LocalTranscriptionProvider',
      );
      return false;
    }

    if (operationName != 'stopRecordingAndSave') {
      final now = DateTime.now();
      if (_lastOperationTime != null) {
        final timeSinceLastOperation = now.difference(_lastOperationTime!);
        if (timeSinceLastOperation < _minimumOperationInterval) {
          developer.log(
            'Operation "$operationName" rejected - too soon after last operation',
            name: 'LocalTranscriptionProvider',
          );
          return false;
        }
      }
    }

    if (!_modelManager.isInitialized && operationName != 'initialization') {
      developer.log(
        'Operation "$operationName" rejected - model not initialized',
        name: 'LocalTranscriptionProvider',
      );
      return false;
    }

    if (_modelManager.isOperationInProgress &&
        operationName != 'stopRecordingAndSave') {
      developer.log(
        'Operation "$operationName" rejected - orchestrator busy',
        name: 'LocalTranscriptionProvider',
      );
      return false;
    }

    _isOperationLocked = true;
    _lastOperationTime = DateTime.now();
    _activeOperations.add(operationName);

    developer.log(
      'Operation lock acquired for: $operationName',
      name: 'LocalTranscriptionProvider',
    );

    Timer(_operationTimeout, () {
      if (_activeOperations.contains(operationName)) {
        developer.log(
          'Operation "$operationName" timed out - releasing lock',
          name: 'LocalTranscriptionProvider',
        );
        _releaseOperationLock(operationName);
      }
    });

    return true;
  }

  /// Releases operation lock
  void _releaseOperationLock(String operationName) {
    _isOperationLocked = false;
    _activeOperations.remove(operationName);

    developer.log(
      'Operation lock released for: $operationName',
      name: 'LocalTranscriptionProvider',
    );
  }

  /// Validates if an operation can be performed in current state
  bool _validateOperationState(
    String operationName,
    TranscriptionState requiredState,
  ) {
    if (_stateManager.state != requiredState) {
      developer.log(
        'Operation "$operationName" invalid - current state: ${_stateManager.state}, required: $requiredState',
        name: 'LocalTranscriptionProvider',
      );
      return false;
    }
    return true;
  }

  /// Handles partial transcription updates during recording
  void _onPartialTranscription(String partial) {
    _uiStateProvider.updateStreamingText(partial);

    if (_modelManager.selectedModelType == ModelType.vosk &&
        _stateManager.isRecording) {
      final sessionId =
          _uiStateProvider.recordingSessionId ??
          _sessionProvider.activeSessionId;
      _uiStateProvider.updatePreviewForRecording(
        ModelType.vosk,
        partial,
        sessionId,
        true,
      );
    }
  }

  /// Handles session changes
  void _onSessionChanged() async {
    final validSessionIds = _sessionProvider.sessions.map((s) => s.id).toSet();
    await _dataProvider.cleanupDeletedSessions(validSessionIds);

    if (_uiStateProvider.recordingSessionId != null &&
        _uiStateProvider.recordingSessionId !=
            _sessionProvider.activeSessionId) {
      developer.log(
        'Session changed during recording/transcribing. Clearing previews for UI consistency.',
        name: 'LocalTranscriptionProvider',
      );
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
      final error = await _modelManager.initializeSelectedModel();

      if (error != null) {
        _stateManager.setError(error);
        return;
      }

      _operationProvider.initializeOrchestrator(_modelManager.orchestrator);

      _stateManager.transitionTo(TranscriptionState.ready);
    } catch (e, stackTrace) {
      developer.log(
        'Error during initialization: $e',
        name: 'LocalTranscriptionProvider',
        error: e,
        stackTrace: stackTrace,
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
  bool get isDownloadingModel => _modelManager.isDownloadingModel;
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

    if (!_modelManager.isInitialized) {
      developer.log(
        'Model not ready for recording, attempting reinitialization',
        name: 'LocalTranscriptionProvider',
      );

      await _modelManager.forceReinitialize();

      await Future.delayed(const Duration(milliseconds: 100));

      if (!_modelManager.isInitialized) {
        _stateManager.setError(
          'Model failed to initialize. Please try switching models.',
        );
        return false;
      }
    }

    if (!await _acquireOperationLock(operationName)) {
      return false;
    }

    if (!_validateOperationState(operationName, TranscriptionState.ready)) {
      _releaseOperationLock(operationName);
      return false;
    }

    if (!_stateManager.transitionTo(TranscriptionState.recording)) {
      _releaseOperationLock(operationName);
      return false;
    }

    final sessionId = _sessionProvider.activeSessionId;
    _uiStateProvider.setRecordingSessionId(sessionId);

    try {
      final success = await _operationProvider.startRecording(
        _modelManager.selectedModelType,
        sessionId,
      );

      if (!success) {
        _stateManager.setError('Failed to start recording');
        _uiStateProvider.clearRecordingSessionId();
        return false;
      }

      if (_modelManager.selectedModelType == ModelType.vosk) {
        _uiStateProvider.updateLiveVoskPreview('', sessionId);
        _uiStateProvider.clearWhisperLoadingPreview();
      } else {
        _uiStateProvider.clearLiveVoskPreview();
      }

      developer.log(
        'Recording started successfully for session: $sessionId',
        name: 'LocalTranscriptionProvider',
      );

      return true;
    } catch (e, stack) {
      _stateManager.setError('Failed to start recording: $e');
      _uiStateProvider.clearRecordingSessionId();
      developer.log(
        'Error starting recording: $e',
        name: 'LocalTranscriptionProvider',
        error: e,
        stackTrace: stack,
      );
      return false;
    } finally {
      _releaseOperationLock(operationName);
    }
  }

  /// Stops recording and saves transcription
  Future<void> stopRecordingAndSave() async {
    const operationName = 'stopRecordingAndSave';

    if (!_stateManager.isRecording) {
      developer.log(
        'Stop recording called but not in recording state: ${_stateManager.state}',
        name: 'LocalTranscriptionProvider',
      );
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

    if (modelType == ModelType.whisper) {
      _uiStateProvider.createWhisperLoadingPreview(sessionId);
    }

    try {
      final result = await _operationProvider.stopRecordingAndTranscribe(
        modelType,
        sessionId,
      );

      if (modelType == ModelType.vosk) {
        _uiStateProvider.clearLiveVoskPreview();
      } else {
        _uiStateProvider.clearWhisperLoadingPreview();
      }

      if (result.isSuccess) {
        if (result.transcription != null &&
            result.transcription!.text.trim().isNotEmpty) {
          _dataProvider.addTranscription(result.transcription!);
          developer.log(
            'Recording stopped and transcription saved successfully',
            name: 'LocalTranscriptionProvider',
          );
        } else {
          developer.log(
            'Recording stopped successfully - no speech detected (empty recording)',
            name: 'LocalTranscriptionProvider',
          );
        }
        _stateManager.transitionTo(TranscriptionState.ready);
      } else {
        final errorMessage = result.errorMessage ?? 'Unknown error';
        _stateManager.setError(errorMessage);
      }
    } catch (e, stack) {
      _stateManager.setError('Error stopping/saving transcription: $e');
      developer.log(
        'Error in stopRecordingAndSave: $e',
        name: 'LocalTranscriptionProvider',
        error: e,
        stackTrace: stack,
      );

      _uiStateProvider.clearLiveVoskPreview();
      _uiStateProvider.clearWhisperLoadingPreview();
    } finally {
      _uiStateProvider.clearRecordingSessionId();
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
    developer.log(
      'Force resetting system to clear stuck states',
      name: 'LocalTranscriptionProvider',
    );

    _isOperationLocked = false;
    _activeOperations.clear();
    _lastOperationTime = null;

    _uiStateProvider.clearRecordingSessionId();
    _uiStateProvider.clearLiveVoskPreview();
    _uiStateProvider.clearWhisperLoadingPreview();

    await _modelManager.forceReinitialize();

    _stateManager.transitionTo(TranscriptionState.ready);

    developer.log('System reset completed', name: 'LocalTranscriptionProvider');
  }

  // ============================================================================
  // PUBLIC API - Data operations
  // ============================================================================

  Future<void> loadTranscriptions() => _dataProvider.loadTranscriptions();

  Future<void> loadTranscriptionsForSession(String sessionId) =>
      _dataProvider.loadTranscriptionsForSession(sessionId);

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

  @override
  void dispose() {
    _sessionProvider.removeListener(_onSessionChanged);
    _stateManager.dispose();
    _modelManager.dispose();
    _uiStateProvider.dispose();
    _operationProvider.dispose();
    _dataProvider.dispose();
    super.dispose();
  }
}
