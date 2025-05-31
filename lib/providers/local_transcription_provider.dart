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
  // Specialized providers for different concerns
  late final TranscriptionStateManager _stateManager;
  late final ModelManagementProvider _modelManager;
  late final TranscriptionUIStateProvider _uiStateProvider;
  late final TranscriptionOperationProvider _operationProvider;
  late final TranscriptionDataProvider _dataProvider;

  final SessionProvider _sessionProvider;

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
    // Listen to session changes
    _sessionProvider.addListener(_onSessionChanged);

    // Setup partial transcription handling
    _operationProvider.setPartialTranscriptionCallback(_onPartialTranscription);

    // Forward state changes to UI
    _stateManager.addListener(notifyListeners);
    _modelManager.addListener(notifyListeners);
    _uiStateProvider.addListener(notifyListeners);
    _operationProvider.addListener(notifyListeners);
    _dataProvider.addListener(notifyListeners);
  }

  /// Handles partial transcription updates during recording
  void _onPartialTranscription(String partial) {
    _uiStateProvider.updateStreamingText(partial);

    // Update live preview if recording with Vosk
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
    // Clean up data for deleted sessions
    final validSessionIds = _sessionProvider.sessions.map((s) => s.id).toSet();
    await _dataProvider.cleanupDeletedSessions(validSessionIds);

    // Clean up UI previews for session changes during recording
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
    _stateManager.transitionTo(TranscriptionState.loading);

    try {
      // Load transcription data
      await _dataProvider.loadTranscriptions();

      // Load and initialize selected model
      await _modelManager.loadSelectedModelType();
      final error = await _modelManager.initializeSelectedModel();

      if (error != null) {
        _stateManager.setError(error);
        return;
      }

      // Setup orchestrator communication
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

  // Model management
  ModelType get selectedModelType => _modelManager.selectedModelType;

  // UI state
  String get currentStreamingText => _uiStateProvider.currentStreamingText;
  Transcription? get liveVoskTranscriptionPreview =>
      _uiStateProvider.getLiveVoskTranscriptionPreviewForSession(
        _sessionProvider.activeSessionId,
      );
  Transcription? get loadingWhisperTranscriptionPreview =>
      _uiStateProvider.getLoadingWhisperTranscriptionPreviewForSession(
        _sessionProvider.activeSessionId,
      );

  // Data access
  List<Transcription> get transcriptions => _dataProvider.transcriptions;
  List<Transcription> get allTranscriptions => _dataProvider.allTranscriptions;
  List<Transcription> get sessionTranscriptions =>
      _dataProvider.sessionTranscriptions;

  // ============================================================================
  // PUBLIC API - Operations
  // ============================================================================

  /// Changes the transcription model
  Future<void> changeModel(ModelType newModelType) async {
    if (!_stateManager.transitionTo(TranscriptionState.loading)) {
      return;
    }

    final error = await _modelManager.changeModel(newModelType);

    if (error != null) {
      _stateManager.setError(error);
    } else {
      // Reinitialize orchestrator connection
      _operationProvider.initializeOrchestrator(_modelManager.orchestrator);
      _stateManager.transitionTo(TranscriptionState.ready);
    }
  }

  /// Starts recording
  Future<bool> startRecording() async {
    if (!_stateManager.transitionTo(TranscriptionState.recording)) {
      return false;
    }

    if (_modelManager.isOperationInProgress) {
      _stateManager.setError('Another operation is in progress. Please wait.');
      return false;
    }

    // Capture recording session
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

      // Setup UI state for recording
      if (_modelManager.selectedModelType == ModelType.vosk) {
        _uiStateProvider.updateLiveVoskPreview('', sessionId);
        _uiStateProvider.clearWhisperLoadingPreview();
      } else {
        _uiStateProvider.clearLiveVoskPreview();
      }

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
    }
  }

  /// Stops recording and saves transcription
  Future<void> stopRecordingAndSave() async {
    if (!_stateManager.transitionTo(TranscriptionState.transcribing)) {
      return;
    }

    final modelType = _modelManager.selectedModelType;
    final sessionId =
        _uiStateProvider.recordingSessionId ?? _sessionProvider.activeSessionId;

    // Show loading preview for Whisper
    if (modelType == ModelType.whisper) {
      _uiStateProvider.createWhisperLoadingPreview(sessionId);
    }

    try {
      final result = await _operationProvider.stopRecordingAndTranscribe(
        modelType,
        sessionId,
      );

      // Clear UI previews
      if (modelType == ModelType.vosk) {
        _uiStateProvider.clearLiveVoskPreview();
      } else {
        _uiStateProvider.clearWhisperLoadingPreview();
      }

      if (result.isSuccess) {
        // Add transcription to data provider
        _dataProvider.addTranscription(result.transcription!);
        _stateManager.transitionTo(TranscriptionState.ready);
      } else {
        _stateManager.setError(result.errorMessage!);
      }
    } catch (e, stack) {
      _stateManager.setError('Error stopping/saving transcription: $e');
      _uiStateProvider.clearLiveVoskPreview();
      _uiStateProvider.clearWhisperLoadingPreview();
      developer.log(
        'Error in stopRecordingAndSave: $e',
        name: 'LocalTranscriptionProvider',
        error: e,
        stackTrace: stack,
      );
    } finally {
      _uiStateProvider.clearRecordingSessionId();
    }
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
