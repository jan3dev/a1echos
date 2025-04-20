import 'dart:io';

import '../models/transcription.dart';
import '../services/storage_service.dart';

/// Repository that abstracts persistent storage for transcriptions and audio files.
class TranscriptionRepository {
  final StorageService _storageService = StorageService();

  /// Fetches all stored transcriptions.
  Future<List<Transcription>> getTranscriptions() =>
      _storageService.getTranscriptions();

  /// Saves a transcription record.
  Future<void> saveTranscription(Transcription transcription) =>
      _storageService.saveTranscription(transcription);

  /// Deletes a transcription by ID.
  Future<void> deleteTranscription(String id) =>
      _storageService.deleteTranscription(id);

  /// Clears all transcriptions.
  Future<void> clearTranscriptions() => _storageService.clearTranscriptions();

  /// Saves an audio file and returns its new path.
  Future<String> saveAudioFile(File audioFile, String fileName) =>
      _storageService.saveAudioFile(audioFile, fileName);
}
