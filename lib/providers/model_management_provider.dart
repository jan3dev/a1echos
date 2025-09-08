import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:async';
import 'dart:io';

import '../models/model_type.dart';
import '../models/spoken_language.dart';
import '../services/vosk_service.dart';
import '../services/whisper_service.dart';
import '../managers/transcription_orchestrator.dart';
import '../services/audio_service.dart';
import '../logger.dart';

class ModelManagementProvider with ChangeNotifier {
  final VoskService _voskService = VoskService();
  WhisperService? _whisperService;
  late TranscriptionOrchestrator _orchestrator;
  final AudioService _sharedAudioService;

  ModelType _selectedModelType = ModelType.vosk;
  static const String _prefsKeyModelType = 'selected_model_type';
  static const String _prefsKeyWhisperRealtime = 'whisper_realtime';
  static const String _prefsKeySpokenLanguage = 'spoken_language';
  bool _isInitialized = false;
  bool _isInitializing = false;
  DateTime? _lastInitializationAttempt;

  SpokenLanguage _selectedLanguage = SupportedLanguages.defaultLanguage;
  SpokenLanguage get selectedLanguage => _selectedLanguage;

  static const Duration _minimumInitializationInterval = Duration(
    milliseconds: 500,
  );
  static const Duration _initializationTimeout = Duration(minutes: 5);

  ModelType get selectedModelType => _selectedModelType;
  bool get isInitialized => _isInitialized;
  bool get isInitializing => _isInitializing;
  VoskService get voskService => _voskService;
  WhisperService? get whisperService => _whisperService;
  TranscriptionOrchestrator get orchestrator => _orchestrator;

  bool _whisperRealtime = false;
  bool get whisperRealtime => _whisperRealtime;

  /// Returns whether language selection is available for the current model
  bool get isLanguageSelectionAvailable => _selectedModelType == ModelType.whisper;

  /// Returns the current initialization status message
  String? get initializationStatus {
    if (_selectedModelType == ModelType.whisper) {
      return _whisperService?.initializationStatus;
    }
    return null;
  }

  ModelManagementProvider(this._sharedAudioService) {
    _whisperService = WhisperService();

    _orchestrator = TranscriptionOrchestrator(
      _sharedAudioService,
      _voskService,
      _whisperService,
    );
  }

  /// Validates if initialization can proceed
  bool _canInitialize() {
    if (_isInitializing) {
      return false;
    }

    final now = DateTime.now();
    if (_lastInitializationAttempt != null) {
      final timeSinceLastAttempt = now.difference(_lastInitializationAttempt!);
      if (timeSinceLastAttempt < _minimumInitializationInterval) {
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

      _whisperRealtime = prefs.getBool(_prefsKeyWhisperRealtime) ?? false;

      final languageCode = prefs.getString(_prefsKeySpokenLanguage) ?? 'en';
      _selectedLanguage = SupportedLanguages.findByCode(languageCode) ?? 
                         SupportedLanguages.defaultLanguage;

      // Disable real-time flag on non-iOS platforms where it is unsupported.
      if (!Platform.isIOS && _whisperRealtime) {
        _whisperRealtime = false;
        await prefs.setBool(_prefsKeyWhisperRealtime, false);
      }

      // On iOS, default to Whisper if no preference is set since Vosk is not supported
      if (Platform.isIOS && _selectedModelType == ModelType.vosk) {
        _selectedModelType = ModelType.whisper;
        _whisperRealtime = false;
        await _saveSelectedModelType(_selectedModelType);
      }

      notifyListeners();
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.provider,
        message: 'Error loading selected model type',
      );
    }
  }

  /// Saves the selected model type to preferences
  Future<void> _saveSelectedModelType(ModelType type) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefsKeyModelType, type.name);
      await prefs.setBool(_prefsKeyWhisperRealtime, _whisperRealtime);
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.provider,
        message: 'Error saving selected model type',
      );
    }
  }

  /// Initializes the selected model with enhanced protection against concurrent calls
  Future<String?> initializeSelectedModel() async {
    if (!_canInitialize()) {
      return 'Model initialization is already in progress or was attempted too recently';
    }

    if (_selectedModelType == ModelType.whisper && !_whisperRealtime) {
      _isInitialized = true;
      return null;
    }

    _isInitializing = true;
    _isInitialized = false;
    _lastInitializationAttempt = DateTime.now();
    notifyListeners();

    Timer? timeoutTimer;
    timeoutTimer = Timer(_initializationTimeout, () {
      if (_isInitializing) {
        _isInitializing = false;
        _isInitialized = false;
        notifyListeners();
      }
    });

    try {
      bool initResult = false;

      if (_selectedModelType == ModelType.vosk) {
        await _voskService.dispose();

        final initialized = await _voskService.initialize(
          'assets/models/vosk-model-small-en-us-0.15.zip',
        );
        if (initialized) {
          initResult = true;
        } else {
          return 'Failed to initialize Vosk service.';
        }
      } else if (_selectedModelType == ModelType.whisper) {
        initResult = await _whisperService!.initialize();

        if (!initResult) {
          return 'Failed to initialize Whisper service via plugin.';
        }
      } else {
        return 'Unknown model type: ${_selectedModelType.name}';
      }

      _isInitialized = initResult;

      return null;
    } catch (e, st) {
      final errorMessage =
          'Error initializing ${_selectedModelType.name} model: $e';
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.provider,
        message: errorMessage,
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
      return null;
    }

    if (newModelType == ModelType.vosk) {
      await _voskService.dispose();
      _whisperRealtime = false;
    }

    _selectedModelType = newModelType;
    _isInitialized = false;

    await _saveSelectedModelType(newModelType);

    final error = await initializeSelectedModel();
    notifyListeners();
    return error;
  }

  bool get isOperationInProgress => _orchestrator.isOperationInProgress;
  Future<String?> forceReinitialize() async {
    _isInitialized = false;
    _isInitializing = false;
    _lastInitializationAttempt = null;
    return await initializeSelectedModel();
  }

  /// Sets the real-time mode for Whisper and saves it.
  Future<void> setWhisperRealtime(bool isRealtime) async {
    if (Platform.isIOS) {
      _whisperRealtime = isRealtime;
      _isInitialized = false;
      await _saveSelectedModelType(_selectedModelType);
      await initializeSelectedModel();
      notifyListeners();
    }
  }

  /// Marks the system as initialized for file-based mode without loading the model
  void markAsInitializedForFileBased() {
    if (_selectedModelType == ModelType.whisper && !_whisperRealtime) {
      _isInitialized = true;
      notifyListeners();
    }
  }

  /// Sets the selected spoken language
  Future<void> setSelectedLanguage(SpokenLanguage language) async {
    if (_selectedLanguage == language) return;
    
    _selectedLanguage = language;
    
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefsKeySpokenLanguage, language.code);
      notifyListeners();
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.provider,
        message: 'Error saving selected language',
      );
    }
  }

  @override
  void dispose() {
    _orchestrator.dispose();
    super.dispose();
  }
}
