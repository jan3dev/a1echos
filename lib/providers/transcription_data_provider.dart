import 'package:flutter/foundation.dart';
import '../models/transcription.dart';
import '../repositories/transcription_repository.dart';
import '../managers/session_transcription_manager.dart';
import 'session_provider.dart';

class TranscriptionDataProvider with ChangeNotifier {
  final TranscriptionRepository _repository = TranscriptionRepository();
  late final SessionTranscriptionManager _sessionManager;
  final SessionProvider _sessionProvider;

  List<Transcription> _transcriptions = [];

  List<Transcription> get transcriptions => _transcriptions;
  List<Transcription> get allTranscriptions => _transcriptions;

  TranscriptionDataProvider(this._sessionProvider) {
    _sessionManager = SessionTranscriptionManager(_repository);
  }

  /// Gets transcriptions for the current active session
  List<Transcription> get sessionTranscriptions => _sessionManager
      .filterBySession(_transcriptions, _sessionProvider.activeSessionId);

  /// Loads all transcriptions from the repository
  Future<void> loadTranscriptions() async {
    try {
      _transcriptions = await _repository.getTranscriptions();
      _transcriptions.sort((a, b) => a.timestamp.compareTo(b.timestamp));

      notifyListeners();
    } catch (e) {
      throw Exception('Failed to load transcriptions: $e');
    }
  }

  /// Loads transcriptions for a specific session
  Future<void> loadTranscriptionsForSession(String sessionId) async {
    try {
      final allTranscriptions = await _repository.getTranscriptions();
      _transcriptions = allTranscriptions
          .where((t) => t.sessionId == sessionId)
          .toList();
      _transcriptions.sort((a, b) => a.timestamp.compareTo(b.timestamp));

      notifyListeners();
    } catch (e) {
      throw Exception('Failed to load transcriptions for session: $e');
    }
  }

  /// Adds a new transcription to the data set
  void addTranscription(Transcription transcription) {
    _transcriptions.add(transcription);
    _transcriptions.sort((a, b) => a.timestamp.compareTo(b.timestamp));

    notifyListeners();
  }

  /// Updates an existing transcription by id
  Future<void> updateTranscription(Transcription updated) async {
    try {
      final index = _transcriptions.indexWhere((t) => t.id == updated.id);
      if (index == -1) throw Exception('Transcription not found');
      _transcriptions[index] = updated;
      await _repository.deleteTranscription(updated.id); // Remove old
      await _repository.saveTranscription(updated); // Save new
      await _sessionProvider.updateSessionModifiedTimestamp(updated.sessionId);
      notifyListeners();
    } catch (e) {
      throw Exception('Failed to update transcription: $e');
    }
  }

  /// Deletes a single transcription
  Future<void> deleteTranscription(String id) async {
    try {
      final transcription = _transcriptions.firstWhere((t) => t.id == id);
      final sessionId = transcription.sessionId;

      await _repository.deleteTranscription(id);
      _transcriptions.removeWhere((t) => t.id == id);

      await _sessionProvider.updateSessionModifiedTimestamp(sessionId);

      notifyListeners();
    } catch (e) {
      throw Exception('Failed to delete transcription: $e');
    }
  }

  /// Deletes multiple transcriptions
  Future<void> deleteTranscriptions(Set<String> ids) async {
    try {
      final sessionIds = <String>{};

      for (final id in ids) {
        final transcription = _transcriptions.firstWhere((t) => t.id == id);
        sessionIds.add(transcription.sessionId);
        await _repository.deleteTranscription(id);
      }

      _transcriptions.removeWhere((t) => ids.contains(t.id));

      for (final sessionId in sessionIds) {
        await _sessionProvider.updateSessionModifiedTimestamp(sessionId);
      }

      notifyListeners();
    } catch (e) {
      throw Exception('Failed to delete transcriptions: $e');
    }
  }

  /// Clears all transcriptions
  Future<void> clearTranscriptions() async {
    try {
      await _repository.clearTranscriptions();
      await loadTranscriptions();
    } catch (e) {
      throw Exception('Failed to clear transcriptions: $e');
    }
  }

  /// Deletes a paragraph from a transcription
  Future<void> deleteParagraphFromTranscription(
    String id,
    int paragraphIndex,
  ) async {
    try {
      final transcription = _transcriptions.firstWhere((t) => t.id == id);
      final sessionId = transcription.sessionId;

      final updatedList = await _sessionManager.deleteParagraph(
        id,
        paragraphIndex,
      );
      _transcriptions = updatedList;

      await _sessionProvider.updateSessionModifiedTimestamp(sessionId);

      notifyListeners();
    } catch (e) {
      throw Exception('Failed to delete paragraph: $e');
    }
  }

  /// Clears transcriptions for a specific session
  Future<void> clearTranscriptionsForSession(String sessionId) async {
    try {
      final remaining = await _sessionManager.clearSession(sessionId);
      _transcriptions = remaining;

      await _sessionProvider.updateSessionModifiedTimestamp(sessionId);

      notifyListeners();
    } catch (e) {
      throw Exception('Failed to clear session transcriptions: $e');
    }
  }

  /// Deletes all transcriptions for a session
  Future<void> deleteAllTranscriptionsForSession(String sessionId) async {
    try {
      _transcriptions.removeWhere((t) => t.sessionId == sessionId);
      await _repository.deleteTranscriptionsForSession(sessionId);

      notifyListeners();
    } catch (e) {
      throw Exception('Failed to delete transcriptions for session: $e');
    }
  }

  /// Handles session cleanup when sessions are deleted
  Future<void> cleanupDeletedSessions(Set<String> validSessionIds) async {
    final inMemorySessionIds = _transcriptions.map((t) => t.sessionId).toSet();
    final sessionsToDelete = inMemorySessionIds.difference(validSessionIds);

    bool changed = false;
    if (sessionsToDelete.isNotEmpty) {
      for (final sessionIdToDelete in sessionsToDelete) {
        if (sessionIdToDelete.isEmpty) continue;
        await _repository.deleteTranscriptionsForSession(sessionIdToDelete);
        _transcriptions.removeWhere((t) => t.sessionId == sessionIdToDelete);
      }
      changed = true;
    }

    if (changed) {
      notifyListeners();
    }
  }
}
