import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import '../models/session.dart';

class SessionProvider with ChangeNotifier {
  static const String _prefsKeySessions = 'sessions';
  static const String _prefsKeyActiveSession = 'active_session';
  final Uuid _uuid = const Uuid();

  static const Duration temporarySessionTimeout = Duration(hours: 1);

  List<Session> _sessions = [];
  String _activeSessionId = '';

  List<Session> get sessions {
    _sessions.sort((a, b) => b.lastModified.compareTo(a.lastModified));
    return _sessions;
  }

  String get activeSessionId => _activeSessionId;
  Session get activeSession => _sessions.firstWhere(
    (s) => s.id == _activeSessionId,
    orElse: () => _sessions.first,
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
        for (var session in _sessions) {
          session.lastModified;
        }
      } catch (e) {
        debugPrint("Error loading sessions: $e. Resetting to default.");
        _sessions = [];
      }
    }

    if (_sessions.isEmpty) {
      _sessions = [
        Session(
          id: 'default_session',
          name: 'Default Session',
          timestamp: DateTime.now(),
        ),
      ];
      await _saveSessions();
    }

    await _handleExpiredTemporarySessions();

    _sessions.sort((a, b) => b.lastModified.compareTo(a.lastModified));

    final active = prefs.getString(_prefsKeyActiveSession);
    if (active != null && _sessions.any((s) => s.id == active)) {
      _activeSessionId = active;
    } else {
      _activeSessionId = _sessions.first.id;
      await _saveActiveSession();
    }
    notifyListeners();
  }

  Future<void> _handleExpiredTemporarySessions() async {
    final now = DateTime.now();
    final expiredSessions =
        _sessions
            .where(
              (session) =>
                  session.isTemporary &&
                  now.difference(session.lastModified) >=
                      temporarySessionTimeout,
            )
            .toList();

    if (expiredSessions.isNotEmpty) {
      for (var session in expiredSessions) {
        _sessions.removeWhere((s) => s.id == session.id);
      }

      if (_sessions.isEmpty) {
        _sessions = [
          Session(
            id: 'default_session',
            name: 'Default Session',
            timestamp: now,
          ),
        ];
      }

      await _saveSessions();
    }
  }

  bool isActiveTemporarySessionExpired() {
    if (!isActiveSessionTemporary()) return false;

    final session = _sessions.firstWhere(
      (s) => s.id == _activeSessionId,
      orElse: () => _sessions.first,
    );

    final now = DateTime.now();
    return now.difference(session.lastModified) >= temporarySessionTimeout;
  }

  Future<String> createNewSessionIfExpired() async {
    if (isActiveTemporarySessionExpired()) {
      final now = DateTime.now();
      final formattedDate = "${now.month}/${now.day} ${now.hour}:${now.minute}";
      final sessionName = 'Recording $formattedDate';
      return await createSession(sessionName, isTemporary: true);
    }
    return _activeSessionId;
  }

  Future<void> validateSessionsOnAppStart() async {
    await _handleExpiredTemporarySessions();

    if (isActiveTemporarySessionExpired()) {
      final now = DateTime.now();
      final formattedDate = "${now.month}/${now.day} ${now.hour}:${now.minute}";
      final sessionName = 'Recording $formattedDate';
      await createSession(sessionName, isTemporary: true);
    }
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

  /// Creates a new session with the given name
  /// Returns the ID of the newly created session
  Future<String> createSession(String name, {bool isTemporary = false}) async {
    final now = DateTime.now();
    final sessionId = _uuid.v4();
    final session = Session(
      id: sessionId,
      name: name.trim().isEmpty ? 'New Session' : name.trim(),
      timestamp: now,
      lastModified: now,
      isTemporary: isTemporary,
    );
    _sessions.add(session);
    await _saveSessions();
    _activeSessionId = session.id;
    await _saveActiveSession();
    notifyListeners();
    return sessionId;
  }

  /// Makes a temporary session permanent
  Future<void> makeSessionPermanent(String id) async {
    final idx = _sessions.indexWhere((s) => s.id == id);
    if (idx >= 0 && _sessions[idx].isTemporary) {
      _sessions[idx].isTemporary = false;
      _sessions[idx].lastModified = DateTime.now();
      await _saveSessions();
      notifyListeners();
    }
  }

  /// Checks if the active session is temporary
  bool isActiveSessionTemporary() {
    final idx = _sessions.indexWhere((s) => s.id == _activeSessionId);
    return idx >= 0 ? _sessions[idx].isTemporary : false;
  }

  /// Renames a session and makes it permanent
  Future<void> saveTemporarySession(String id, String newName) async {
    final idx = _sessions.indexWhere((s) => s.id == id);
    if (idx >= 0 && newName.trim().isNotEmpty) {
      _sessions[idx].name = newName.trim();
      _sessions[idx].isTemporary = false;
      _sessions[idx].lastModified = DateTime.now();
      await _saveSessions();
      notifyListeners();
    }
  }

  Future<void> renameSession(String id, String newName) async {
    final idx = _sessions.indexWhere((s) => s.id == id);
    if (idx >= 0 && newName.trim().isNotEmpty) {
      _sessions[idx].name = newName.trim();
      _sessions[idx].lastModified = DateTime.now();
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
      await _saveSessions();
      notifyListeners();
    }
  }
}
