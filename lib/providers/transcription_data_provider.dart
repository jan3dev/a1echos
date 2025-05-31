import 'package:flutter/foundation.dart';
import 'dart:developer' as developer;
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

      developer.log(
        'Loaded ${_transcriptions.length} transcriptions',
        name: 'TranscriptionDataProvider',
      );

      notifyListeners();
    } catch (e) {
      developer.log(
        'Failed to load transcriptions: $e',
        name: 'TranscriptionDataProvider',
        error: e,
      );
      throw Exception('Failed to load transcriptions: $e');
    }
  }

  /// Loads transcriptions for a specific session
  Future<void> loadTranscriptionsForSession(String sessionId) async {
    try {
      final allTranscriptions = await _repository.getTranscriptions();
      _transcriptions =
          allTranscriptions.where((t) => t.sessionId == sessionId).toList();
      _transcriptions.sort((a, b) => a.timestamp.compareTo(b.timestamp));

      developer.log(
        'Loaded ${_transcriptions.length} transcriptions for session: $sessionId',
        name: 'TranscriptionDataProvider',
      );

      notifyListeners();
    } catch (e) {
      developer.log(
        'Failed to load transcriptions for session: $e',
        name: 'TranscriptionDataProvider',
        error: e,
      );
      throw Exception('Failed to load transcriptions for session: $e');
    }
  }

  /// Adds a new transcription to the data set
  void addTranscription(Transcription transcription) {
    _transcriptions.add(transcription);
    _transcriptions.sort((a, b) => a.timestamp.compareTo(b.timestamp));

    developer.log(
      'Added transcription: ${transcription.id}',
      name: 'TranscriptionDataProvider',
    );

    notifyListeners();
  }

  /// Deletes a single transcription
  Future<void> deleteTranscription(String id) async {
    try {
      final transcription = _transcriptions.firstWhere((t) => t.id == id);
      final sessionId = transcription.sessionId;

      await _repository.deleteTranscription(id);
      _transcriptions.removeWhere((t) => t.id == id);

      await _sessionProvider.updateSessionModifiedTimestamp(sessionId);

      developer.log(
        'Deleted transcription: $id',
        name: 'TranscriptionDataProvider',
      );

      notifyListeners();
    } catch (e) {
      developer.log(
        'Failed to delete transcription: $e',
        name: 'TranscriptionDataProvider',
        error: e,
      );
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

      developer.log(
        'Deleted ${ids.length} transcriptions',
        name: 'TranscriptionDataProvider',
      );

      notifyListeners();
    } catch (e) {
      developer.log(
        'Failed to delete transcriptions: $e',
        name: 'TranscriptionDataProvider',
        error: e,
      );
      throw Exception('Failed to delete transcriptions: $e');
    }
  }

  /// Clears all transcriptions
  Future<void> clearTranscriptions() async {
    try {
      await _repository.clearTranscriptions();
      await loadTranscriptions();

      developer.log(
        'Cleared all transcriptions',
        name: 'TranscriptionDataProvider',
      );
    } catch (e) {
      developer.log(
        'Error clearing transcriptions: $e',
        name: 'TranscriptionDataProvider',
        error: e,
      );
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

      developer.log(
        'Deleted paragraph $paragraphIndex from transcription: $id',
        name: 'TranscriptionDataProvider',
      );

      notifyListeners();
    } catch (e) {
      developer.log(
        'Error deleting paragraph: $e',
        name: 'TranscriptionDataProvider',
        error: e,
      );
      throw Exception('Failed to delete paragraph: $e');
    }
  }

  /// Clears transcriptions for a specific session
  Future<void> clearTranscriptionsForSession(String sessionId) async {
    try {
      final remaining = await _sessionManager.clearSession(sessionId);
      _transcriptions = remaining;

      await _sessionProvider.updateSessionModifiedTimestamp(sessionId);

      developer.log(
        'Cleared transcriptions for session: $sessionId',
        name: 'TranscriptionDataProvider',
      );

      notifyListeners();
    } catch (e) {
      developer.log(
        'Error clearing session transcriptions: $e',
        name: 'TranscriptionDataProvider',
        error: e,
      );
      throw Exception('Failed to clear session transcriptions: $e');
    }
  }

  /// Deletes all transcriptions for a session
  Future<void> deleteAllTranscriptionsForSession(String sessionId) async {
    try {
      _transcriptions.removeWhere((t) => t.sessionId == sessionId);
      await _repository.deleteTranscriptionsForSession(sessionId);

      developer.log(
        'Deleted all transcriptions for session: $sessionId',
        name: 'TranscriptionDataProvider',
      );

      notifyListeners();
    } catch (e) {
      developer.log(
        'Error deleting transcriptions for session: $e',
        name: 'TranscriptionDataProvider',
        error: e,
      );
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
      developer.log(
        'Cleaned up transcriptions for ${sessionsToDelete.length} deleted sessions',
        name: 'TranscriptionDataProvider',
      );
      notifyListeners();
    }
  }
}
