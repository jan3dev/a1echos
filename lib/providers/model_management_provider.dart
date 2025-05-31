import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:developer' as developer;
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

  ModelType get selectedModelType => _selectedModelType;
  bool get isInitialized => _isInitialized;
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

  /// Initializes the currently selected model
  Future<String?> initializeSelectedModel() async {
    _isInitialized = false;

    try {
      bool initResult = false;

      if (_selectedModelType == ModelType.vosk) {
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

      notifyListeners();
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
      notifyListeners();
      return errorMessage;
    }
  }

  /// Changes the model type and reinitializes
  Future<String?> changeModel(ModelType newModelType) async {
    if (_selectedModelType == newModelType && _isInitialized) {
      return null;
    }

    final previousModelType = _selectedModelType;
    _selectedModelType = newModelType;
    _isInitialized = false;
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

  @override
  void dispose() {
    _orchestrator.dispose();
    super.dispose();
  }
}
