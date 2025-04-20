import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import '../models/session.dart';

class SessionProvider with ChangeNotifier {
  static const String _prefsKeySessions = 'sessions';
  static const String _prefsKeyActiveSession = 'active_session';
  final Uuid _uuid = const Uuid();

  List<Session> _sessions = [];
  String _activeSessionId = '';

  List<Session> get sessions => _sessions;
  String get activeSessionId => _activeSessionId;
  Session get activeSession =>
      _sessions.firstWhere((s) => s.id == _activeSessionId);

  SessionProvider() {
    _loadSessions();
  }

  Future<void> _loadSessions() async {
    final prefs = await SharedPreferences.getInstance();
    final sessionsJson = prefs.getString(_prefsKeySessions);
    if (sessionsJson != null) {
      final List<dynamic> list = jsonDecode(sessionsJson);
      _sessions = list.map((m) => Session.fromJson(m)).toList();
    } else {
      _sessions = [
        Session(
          id: 'default_session',
          name: 'Default',
          timestamp: DateTime.now(),
        ),
      ];
      await _saveSessions();
    }
    final active = prefs.getString(_prefsKeyActiveSession);
    if (active != null && _sessions.any((s) => s.id == active)) {
      _activeSessionId = active;
    } else {
      _activeSessionId = _sessions.first.id;
      await _saveActiveSession();
    }
    notifyListeners();
  }

  Future<void> _saveSessions() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _prefsKeySessions,
      jsonEncode(_sessions.map((s) => s.toJson()).toList()),
    );
  }

  Future<void> _saveActiveSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKeyActiveSession, _activeSessionId);
  }

  Future<void> createSession(String name) async {
    final session = Session(
      id: _uuid.v4(),
      name: name,
      timestamp: DateTime.now(),
    );
    _sessions.add(session);
    await _saveSessions();
    notifyListeners();
  }

  Future<void> renameSession(String id, String newName) async {
    final idx = _sessions.indexWhere((s) => s.id == id);
    if (idx >= 0) {
      _sessions[idx].name = newName;
      await _saveSessions();
      notifyListeners();
    }
  }

  Future<void> switchSession(String id) async {
    if (_sessions.any((s) => s.id == id)) {
      _activeSessionId = id;
      await _saveActiveSession();
      notifyListeners();
    }
  }

  Future<void> deleteSession(String id) async {
    if (_sessions.length <= 1) return;
    _sessions.removeWhere((s) => s.id == id);
    if (_activeSessionId == id) {
      _activeSessionId = _sessions.first.id;
      await _saveActiveSession();
    }
    await _saveSessions();
    notifyListeners();
  }
}
