import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:developer' as developer;
import 'dart:async';
import '../models/model_type.dart';
import '../services/vosk_service.dart';
import '../services/whisper_service.dart';
import '../managers/transcription_orchestrator.dart';
import '../services/audio_service.dart';

class ModelManagementProvider with ChangeNotifier {
  final VoskService _voskService = VoskService();
  WhisperService? _whisperService;
  late TranscriptionOrchestrator _orchestrator;

  ModelType _selectedModelType = ModelType.vosk;
  static const String _prefsKeyModelType = 'selected_model_type';
  bool _isInitialized = false;
  bool _isInitializing = false;
  DateTime? _lastInitializationAttempt;

  static const Duration _minimumInitializationInterval = Duration(
    milliseconds: 500,
  );
  static const Duration _initializationTimeout = Duration(seconds: 30);

  ModelType get selectedModelType => _selectedModelType;
  bool get isInitialized => _isInitialized;
  bool get isInitializing => _isInitializing;
  VoskService get voskService => _voskService;
  WhisperService? get whisperService => _whisperService;
  TranscriptionOrchestrator get orchestrator => _orchestrator;

  ModelManagementProvider() {
    _orchestrator = TranscriptionOrchestrator(
      AudioService(),
      _voskService,
      _whisperService,
    );
  }

  /// Validates if initialization can proceed
  bool _canInitialize() {
    if (_isInitializing) {
      developer.log(
        'Initialization already in progress',
        name: 'ModelManagementProvider',
      );
      return false;
    }

    final now = DateTime.now();
    if (_lastInitializationAttempt != null) {
      final timeSinceLastAttempt = now.difference(_lastInitializationAttempt!);
      if (timeSinceLastAttempt < _minimumInitializationInterval) {
        developer.log(
          'Initialization attempted too soon after last attempt',
          name: 'ModelManagementProvider',
        );
        return false;
      }
    }

    return true;
  }

  /// Loads the selected model type from preferences
  Future<void> loadSelectedModelType() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final modelName =
          prefs.getString(_prefsKeyModelType) ?? ModelType.vosk.name;
      _selectedModelType = ModelType.values.firstWhere(
        (e) => e.name == modelName,
        orElse: () => ModelType.vosk,
      );

      developer.log(
        'Loaded model type: ${_selectedModelType.name}',
        name: 'ModelManagementProvider',
      );
    } catch (e) {
      developer.log(
        'Error loading selected model type: $e',
        name: 'ModelManagementProvider',
      );
      _selectedModelType = ModelType.vosk;
    }
  }

  /// Saves the selected model type to preferences
  Future<void> _saveSelectedModelType(ModelType type) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefsKeyModelType, type.name);
    } catch (e) {
      developer.log(
        'Error saving selected model type: $e',
        name: 'ModelManagementProvider',
      );
    }
  }

  /// Initializes the currently selected model with protection against rapid calls
  Future<String?> initializeSelectedModel() async {
    if (!_canInitialize()) {
      return 'Model initialization is already in progress or was attempted too recently';
    }

    _isInitializing = true;
    _isInitialized = false;
    _lastInitializationAttempt = DateTime.now();
    notifyListeners();

    Timer? timeoutTimer;
    timeoutTimer = Timer(_initializationTimeout, () {
      if (_isInitializing) {
        developer.log(
          'Model initialization timed out',
          name: 'ModelManagementProvider',
        );
        _isInitializing = false;
        _isInitialized = false;
        notifyListeners();
      }
    });

    try {
      bool initResult = false;

      if (_selectedModelType == ModelType.vosk) {
        developer.log(
          'Initializing Vosk model...',
          name: 'ModelManagementProvider',
        );

        final initialized = await _voskService.initialize(
          'assets/models/vosk-model-small-en-us-0.15.zip',
        );
        if (initialized) {
          initResult = true;
          developer.log(
            'Vosk service initialized successfully',
            name: 'ModelManagementProvider',
          );
        } else {
          return 'Failed to initialize Vosk service.';
        }
      } else if (_selectedModelType == ModelType.whisper) {
        developer.log(
          'Initializing Whisper model...',
          name: 'ModelManagementProvider',
        );

        _whisperService = WhisperService();
        initResult = await _whisperService!.initialize();

        if (!initResult) {
          return 'Failed to initialize Whisper service via plugin.';
        } else {
          developer.log(
            'Whisper service initialized successfully',
            name: 'ModelManagementProvider',
          );
        }
      } else {
        return 'Unknown model type: ${_selectedModelType.name}';
      }

      _isInitialized = initResult;

      _orchestrator = TranscriptionOrchestrator(
        AudioService(),
        _voskService,
        _whisperService,
      );

      developer.log(
        'Model initialization completed: ${_selectedModelType.name}',
        name: 'ModelManagementProvider',
      );

      return null;
    } catch (e, stackTrace) {
      final errorMessage =
          'Error initializing ${_selectedModelType.name} model: $e';
      developer.log(
        errorMessage,
        name: 'ModelManagementProvider',
        error: e,
        stackTrace: stackTrace,
      );
      _isInitialized = false;
      return errorMessage;
    } finally {
      timeoutTimer.cancel();
      _isInitializing = false;
      notifyListeners();
    }
  }

  /// Changes the model type and reinitializes with enhanced protection
  Future<String?> changeModel(ModelType newModelType) async {
    if (_selectedModelType == newModelType && _isInitialized) {
      developer.log(
        'Model type unchanged and already initialized: ${newModelType.name}',
        name: 'ModelManagementProvider',
      );
      return null;
    }

    if (!_canInitialize()) {
      return 'Cannot change model - initialization in progress or attempted too recently';
    }

    final previousModelType = _selectedModelType;
    _selectedModelType = newModelType;
    _isInitialized = false;
    notifyListeners();

    developer.log(
      'Changing model from ${previousModelType.name} to ${newModelType.name}',
      name: 'ModelManagementProvider',
    );

    try {
      if (previousModelType == ModelType.whisper) {
        await _whisperService?.dispose();
        _whisperService = null;
        developer.log(
          'Whisper service disposed',
          name: 'ModelManagementProvider',
        );
      } else if (previousModelType == ModelType.vosk) {
        await _voskService.stop();
        await _voskService.dispose();
        developer.log('Vosk service disposed', name: 'ModelManagementProvider');
      }
    } catch (e, stackTrace) {
      developer.log(
        'Error during cleanup of ${previousModelType.name}: $e',
        name: 'ModelManagementProvider',
        error: e,
        stackTrace: stackTrace,
      );
    }

    await _saveSelectedModelType(newModelType);

    return await initializeSelectedModel();
  }

  /// Checks if the orchestrator is busy with an operation
  bool get isOperationInProgress => _orchestrator.isOperationInProgress;

  /// Forces reinitialization (for error recovery)
  Future<String?> forceReinitialize() async {
    developer.log(
      'Force reinitializing model: ${_selectedModelType.name}',
      name: 'ModelManagementProvider',
    );

    _isInitialized = false;
    _isInitializing = false;
    _lastInitializationAttempt = null;

    return await initializeSelectedModel();
  }

  @override
  void dispose() {
    _orchestrator.dispose();
    super.dispose();
  }
}
