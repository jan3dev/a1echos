import '../models/transcription.dart';
import '../repositories/transcription_repository.dart';

/// Manages session-scoped operations on transcriptions.
class SessionTranscriptionManager {
  final TranscriptionRepository _repository;

  SessionTranscriptionManager(this._repository);

  /// Filters [all] to only those in [sessionId].
  List<Transcription> filterBySession(
    List<Transcription> all,
    String sessionId,
  ) {
    return all.where((t) => t.sessionId == sessionId).toList();
  }

  /// Clears all transcriptions for [sessionId], returning the remaining list.
  Future<List<Transcription>> clearSession(String sessionId) async {
    final all = await _repository.getTranscriptions();
    final remaining = all.where((t) => t.sessionId != sessionId).toList();
    await _repository.clearTranscriptions();
    for (final t in remaining) {
      await _repository.saveTranscription(t);
    }
    return remaining;
  }

  /// Deletes a specific paragraph from a transcription, returning the updated list.
  Future<List<Transcription>> deleteParagraph(
    String transcriptionId,
    int paragraphIndex,
  ) async {
    final all = await _repository.getTranscriptions();
    final idx = all.indexWhere((t) => t.id == transcriptionId);
    if (idx < 0) throw Exception('Transcription not found');

    final transcription = all[idx];
    final parts = transcription.text.split('\n\n');
    if (paragraphIndex < 0 || paragraphIndex >= parts.length) {
      throw Exception('Invalid paragraph index');
    }
    parts.removeAt(paragraphIndex);

    if (parts.isEmpty) {
      await _repository.deleteTranscription(transcriptionId);
    } else {
      final updatedText = parts.join('\n\n');
      final updated = Transcription(
        id: transcription.id,
        sessionId: transcription.sessionId,
        text: updatedText,
        timestamp: transcription.timestamp,
        audioPath: transcription.audioPath,
      );
      await _repository.deleteTranscription(transcriptionId);
      await _repository.saveTranscription(updated);
    }

    return await _repository.getTranscriptions();
  }
}
