import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';
import '../providers/local_transcription_provider.dart';
import '../providers/session_provider.dart';
import '../services/audio_service.dart';
import '../utils/permission_dialogs.dart';
import '../logger.dart';

/// Controller for managing recording operations within a session
class SessionRecordingController with ChangeNotifier {
  final LocalTranscriptionProvider _transcriptionProvider;
  final SessionProvider _sessionProvider;
  final AudioService _audioService = AudioService();
  
  BuildContext? _context;
  AquaColors? _colors;

  SessionRecordingController({
    required LocalTranscriptionProvider transcriptionProvider,
    required SessionProvider sessionProvider,
  }) : _transcriptionProvider = transcriptionProvider,
       _sessionProvider = sessionProvider {
    _transcriptionProvider.addListener(_onTranscriptionStateChanged);
  }
  
  void setContext(BuildContext context, AquaColors colors) {
    _context = context;
    _colors = colors;
  }

  @override
  void dispose() {
    _transcriptionProvider.removeListener(_onTranscriptionStateChanged);
    super.dispose();
  }

  void _onTranscriptionStateChanged() {
    notifyListeners();
  }

  bool get isRecording => _transcriptionProvider.isRecording;
  bool get isTranscribing => _transcriptionProvider.isTranscribing;
  bool get isLoading => _transcriptionProvider.isLoading;
  String? get error => _transcriptionProvider.error;

  /// Checks if any operation is currently in progress
  bool get isOperationInProgress =>
      _transcriptionProvider.isOperationInProgress;

  /// Checks if the system is ready for recording operations
  bool get isReadyForRecording =>
      _transcriptionProvider.isModelReady && !isOperationInProgress;

  /// Starts recording for the current session with enhanced validation
  Future<bool> startRecording() async {
    if (isRecording || isTranscribing) {
      return false;
    }

    if (isLoading) {
      return false;
    }

    final hasPermission = await _audioService.hasPermission();
    if (!hasPermission) {
      final isPermanentlyDenied = await _audioService.isPermanentlyDenied();
      if (isPermanentlyDenied) {
        _handlePermissionPermanentlyDenied();
      } else {
        _handlePermissionDenied();
      }
      return false;
    }

    try {
      final success = await _transcriptionProvider.startRecording();
      return success;
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.ui,
        message: 'Failed to start recording via controller',
      );
      return false;
    }
  }
  
  void _handlePermissionDenied() {
    if (_context == null || !_context!.mounted || _colors == null) {
      return;
    }
    
    PermissionDialogs.showMicrophonePermissionDenied(
      _context!,
      _colors!,
      onRetry: () async {
        await Future.delayed(const Duration(milliseconds: 300));
        startRecording();
      },
    );
  }
  
  void _handlePermissionPermanentlyDenied() {
    if (_context == null || !_context!.mounted || _colors == null) {
      return;
    }
    
    PermissionDialogs.showMicrophonePermanentlyDenied(
      _context!,
      _colors!,
    );
  }

  /// Stops recording and saves the transcription with enhanced validation
  Future<void> stopRecordingAndSave() async {
    if (!isRecording && !isTranscribing) {
      return;
    }

    try {
      await _transcriptionProvider.stopRecordingAndSave();
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.ui,
        message: 'Failed to stop recording and save via controller',
      );
    }
  }

  /// Gets the current active session ID
  String get currentSessionId => _sessionProvider.activeSessionId;

  /// Checks if there's an active recording or transcription in progress
  bool get hasActiveOperation => isRecording || isTranscribing;

  /// Gets a user-friendly status message
  String get statusMessage {
    if (isLoading) return 'Initializing...';
    if (isRecording) return 'Recording...';
    if (isTranscribing) return 'Processing transcription...';
    if (error != null) return 'Error: $error';
    if (isOperationInProgress) return 'System busy...';
    if (isReadyForRecording) return 'Ready to record';
    return 'Not ready';
  }

  /// Attempts to recover from error state
  Future<void> recoverFromError() async {
    if (error != null) {
      try {
        if (error!.toLowerCase().contains('model not ready') ||
            error!.toLowerCase().contains('not initialized')) {
          await _transcriptionProvider.forceSystemReset();
        } else {
          await _transcriptionProvider.reinitializeModel();
        }
      } catch (e, st) {
        logger.error(
          e,
          stackTrace: st,
          flag: FeatureFlag.ui,
          message: 'Failed to recover from error state',
        );
      }
    }
  }

  /// Forces a complete system reset
  Future<void> forceSystemReset() async {
    try {
      await _transcriptionProvider.forceSystemReset();
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.ui,
        message: 'Failed to force system reset',
      );
    }
  }
}
