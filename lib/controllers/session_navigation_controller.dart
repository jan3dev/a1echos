import 'package:flutter/material.dart';
import '../providers/session_provider.dart';
import '../providers/settings_provider.dart';
import '../providers/local_transcription_provider.dart';
import '../models/session.dart';
import '../logger.dart';

/// Controller for managing session navigation and lifecycle operations
class SessionNavigationController with ChangeNotifier {
  final SessionProvider _sessionProvider;
  final SettingsProvider _settingsProvider;
  final LocalTranscriptionProvider _transcriptionProvider;
  final String sessionId;

  SessionNavigationController({
    required SessionProvider sessionProvider,
    required SettingsProvider settingsProvider,
    required LocalTranscriptionProvider transcriptionProvider,
    required this.sessionId,
  }) : _sessionProvider = sessionProvider,
       _settingsProvider = settingsProvider,
       _transcriptionProvider = transcriptionProvider {
    _sessionProvider.addListener(_onSessionProviderChanged);
  }

  @override
  void dispose() {
    _sessionProvider.removeListener(_onSessionProviderChanged);
    super.dispose();
  }

  void _onSessionProviderChanged() {
    notifyListeners();
  }

  /// Handles back navigation with proper cleanup
  Future<void> handleBackNavigation(BuildContext context) async {
    if (_transcriptionProvider.isRecording ||
        _transcriptionProvider.isTranscribing) {
      await _transcriptionProvider.stopRecordingAndSave();
    }

    _setDefaultNameIfNeeded();

    if (context.mounted) {
      Navigator.of(context).pop();
    }
  }

  /// Navigates back to the home screen
  Future<void> navigateToHome(BuildContext context) async {
    if (isIncognitoSession) {
      _sessionProvider.deleteSession(sessionId);
    } else {
      _setDefaultNameIfNeeded();
    }

    if (!_settingsProvider.isIncognitoMode ||
        !_transcriptionProvider.isRecording) {
      _cleanupAllIncognitoSessions();
    }

    if (context.mounted) {
      Navigator.of(context).pop();
    }
  }

  /// Cleans up all incognito sessions
  void _cleanupAllIncognitoSessions() {
    final incognitoSessions = _sessionProvider.sessions
        .where((session) => session.isIncognito)
        .toList();

    for (var session in incognitoSessions) {
      _sessionProvider.deleteSession(session.id);
    }
  }

  /// Sets default name for session if it's empty
  void _setDefaultNameIfNeeded() {
    final currentSession = _findSessionById(sessionId);

    if (currentSession != null &&
        !currentSession.isIncognito &&
        currentSession.name.isEmpty) {
      final defaultName = _sessionProvider.getNewSessionName();
      _sessionProvider.renameSession(sessionId, defaultName);
    }
  }

  /// Finds a session by ID
  Session? _findSessionById(String id) {
    try {
      return _sessionProvider.sessions.firstWhere((s) => s.id == id);
    } catch (e) {
      logger.warning('Session with ID $id not found.', flag: FeatureFlag.ui);
      return null;
    }
  }

  /// Initializes the session and loads data
  Future<void> initializeSession() async {
    _sessionProvider.switchSession(sessionId);

    await _transcriptionProvider.loadTranscriptions();
  }

  /// Renames the current session
  void renameSession(String newName) {
    _sessionProvider.renameSession(sessionId, newName);
  }

  /// Gets the current session
  Session? get currentSession => _findSessionById(sessionId);

  /// Gets the current session name
  String get sessionName {
    final session = currentSession;
    return session?.name ?? 'Session';
  }

  /// Checks if the current session is incognito
  bool get isIncognitoSession {
    final session = currentSession;
    return session?.isIncognito ?? false;
  }
}
