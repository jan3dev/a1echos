import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import '../models/session.dart';
import '../constants/app_constants.dart';

class SessionProvider with ChangeNotifier {
  static const String _prefsKeySessions = 'sessions';
  static const String _prefsKeyActiveSession = 'active_session';
  final Uuid _uuid = const Uuid();

  List<Session> _sessions = [];
  String _activeSessionId = '';
  bool _needsSort = true;

  List<Session> get sessions {
    if (_needsSort) {
      _sessions.sort((a, b) => b.lastModified.compareTo(a.lastModified));
      _needsSort = false;
    }
    return List.unmodifiable(_sessions);
  }

  String get activeSessionId => _activeSessionId;
  Session get activeSession => _sessions.firstWhere(
    (s) => s.id == _activeSessionId,
    orElse: () {
      if (_sessions.isNotEmpty) {
        return _sessions.first;
      }
      throw Exception("No sessions available to be active.");
    },
  );

  SessionProvider() {
    _loadSessions();
  }

  Future<void> _loadSessions() async {
    final prefs = await SharedPreferences.getInstance();
    final sessionsJson = prefs.getString(_prefsKeySessions);
    if (sessionsJson != null) {
      try {
        final List<dynamic> list = jsonDecode(sessionsJson);
        _sessions = list.map((m) => Session.fromJson(m)).toList();
      } catch (e) {
        debugPrint("Error loading sessions: $e. Resetting to default.");
        _sessions = [];
      }
    }

    _needsSort = true;

    final active = prefs.getString(_prefsKeyActiveSession);
    if (active != null && _sessions.any((s) => s.id == active)) {
      _activeSessionId = active;
    } else if (_sessions.isNotEmpty) {
      _activeSessionId = _sessions.first.id;
      await _saveActiveSession();
    } else {
      _activeSessionId = '';
    }
    notifyListeners();
  }

  Future<void> _saveSessions() async {
    final prefs = await SharedPreferences.getInstance();
    _sessions.sort((a, b) => b.lastModified.compareTo(a.lastModified));
    await prefs.setString(
      _prefsKeySessions,
      jsonEncode(_sessions.map((s) => s.toJson()).toList()),
    );
  }

  Future<void> _saveActiveSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKeyActiveSession, _activeSessionId);
  }

  String getNewSessionName() {
    const baseName = "${AppStrings.recordingPrefix} ";
    final existingSessionNumbers =
        _sessions
            .where((s) => s.name.startsWith(baseName))
            .map((s) {
              try {
                return int.parse(s.name.substring(baseName.length));
              } catch (e) {
                return null;
              }
            })
            .where((count) => count != null)
            .cast<int>()
            .toList();

    int nextNumber = 1;
    if (existingSessionNumbers.isNotEmpty) {
      nextNumber = existingSessionNumbers.reduce((a, b) => a > b ? a : b) + 1;
    }
    return "$baseName$nextNumber";
  }

  /// Creates a new session
  /// Incognito sessions are created with a default name.
  /// Normal sessions can be created with an empty name and should be named later.
  /// Returns the ID of the newly created session
  Future<String> createSession(String? name, {bool isIncognito = false}) async {
    final now = DateTime.now();
    final sessionId = _uuid.v4();
    String sessionNameToUse = '';

    if (isIncognito) {
      sessionNameToUse = AppStrings.incognitoModeTitle;
    } else {
      if (name == null || name.trim().isEmpty) {
        sessionNameToUse = getNewSessionName();
        if (sessionNameToUse.trim().isEmpty) {
          throw ArgumentError('Session name cannot be empty.');
        }
      } else {
        sessionNameToUse = name.trim();
        if (sessionNameToUse.length > AppConstants.sessionNameMaxLength) {
          sessionNameToUse = sessionNameToUse.substring(
            0,
            AppConstants.sessionNameMaxLength,
          );
        }
      }
    }

    final session = Session(
      id: sessionId,
      name: sessionNameToUse,
      timestamp: now,
      lastModified: now,
      isIncognito: isIncognito,
    );
    _sessions.add(session);
    _needsSort = true;
    await _saveSessions();
    _activeSessionId = session.id;
    await _saveActiveSession();
    notifyListeners();
    return sessionId;
  }

  /// Checks if the active session is incognito
  bool isActiveSessionIncognito() {
    final idx = _sessions.indexWhere((s) => s.id == _activeSessionId);
    return idx >= 0 ? _sessions[idx].isIncognito : false;
  }

  Future<void> renameSession(String id, String newName) async {
    final idx = _sessions.indexWhere((s) => s.id == id);
    if (idx >= 0 && newName.trim().isNotEmpty) {
      String trimmedName = newName.trim();
      if (trimmedName.length > AppConstants.sessionNameMaxLength) {
        trimmedName = trimmedName.substring(
          0,
          AppConstants.sessionNameMaxLength,
        );
      }
      _sessions[idx].name = trimmedName;
      _sessions[idx].lastModified = DateTime.now();
      _needsSort = true;
      await _saveSessions();
      notifyListeners();
    }
  }

  Future<void> switchSession(String id) async {
    if (_activeSessionId != id && _sessions.any((s) => s.id == id)) {
      _activeSessionId = id;
      await _saveActiveSession();
      notifyListeners();
    }
  }

  Future<void> deleteSession(String id) async {
    _sessions.removeWhere((s) => s.id == id);
    _needsSort = true;
    if (_sessions.isEmpty) {
      _activeSessionId = '';
    } else if (_activeSessionId == id) {
      _sessions.sort((a, b) => b.lastModified.compareTo(a.lastModified));
      _activeSessionId = _sessions.first.id;
      await _saveActiveSession();
    }

    await _saveSessions();
    notifyListeners();
  }

  Future<void> updateSessionModifiedTimestamp(String sessionId) async {
    final idx = _sessions.indexWhere((s) => s.id == sessionId);
    if (idx >= 0) {
      _sessions[idx].lastModified = DateTime.now();
      _needsSort = true;
      await _saveSessions();
      notifyListeners();
    }
  }
}
