import 'dart:convert';
import 'dart:io';
import 'dart:developer' as developer;
import '../models/transcription.dart';
import 'encryption_service.dart';
import 'package:path_provider/path_provider.dart';

class StorageService {
  static const String _fileName = 'transcriptions.json';

  Future<String> get _localPath async {
    final directory = await getApplicationDocumentsDirectory();
    return directory.path;
  }

  Future<File> get _localFile async {
    final path = await _localPath;
    return File('$path/$_fileName');
  }

  final _encryptor = EncryptionService();

  Future<List<Transcription>> getTranscriptions() async {
    final file = await _localFile;
    if (!await file.exists()) return [];

    final encrypted = await file.readAsString();
    if (encrypted.isEmpty) return [];

    try {
      // 1) decrypt the JSON
      final jsonString = await _encryptor.decrypt(encrypted);
      final List<dynamic> jsonList = json.decode(jsonString);
      return jsonList.map((m) => Transcription.fromJson(m)).toList();
    } catch (e) {
      await file.delete();
      return [];
    }
  }

  Future<void> _saveTranscriptions(List<Transcription> list) async {
    final file = await _localFile;
    final rawJson = json.encode(list.map((t) => t.toJson()).toList());
    // 2) encrypt before writing
    final encrypted = await _encryptor.encrypt(rawJson);
    await file.writeAsString(encrypted);
  }

  Future<void> saveTranscription(Transcription transcription) async {
    final transcriptions = await getTranscriptions();
    transcriptions.add(transcription);
    await _saveTranscriptions(transcriptions);
  }

  Future<void> deleteTranscription(String id) async {
    final transcriptions = await getTranscriptions();
    transcriptions.removeWhere((item) => item.id == id);
    await _saveTranscriptions(transcriptions);
  }

  Future<void> clearTranscriptions() async {
    await _saveTranscriptions([]);
  }

  Future<String> saveAudioFile(File audioFile, String fileName) async {
    final directory = await getApplicationDocumentsDirectory();
    final path = '${directory.path}/audio';
    await Directory(path).create(recursive: true);

    final targetFile = File('$path/$fileName');
    await audioFile.copy(targetFile.path);

    return targetFile.path;
  }

  Future<void> deleteTranscriptionsForSession(String sessionId) async {
    final transcriptions = await getTranscriptions();
    final List<Transcription> transcriptionsToKeep = [];
    final List<String> audioPathsToDelete = [];

    for (final transcription in transcriptions) {
      if (transcription.sessionId == sessionId) {
        if (transcription.audioPath.isNotEmpty) {
          audioPathsToDelete.add(transcription.audioPath);
        }
      } else {
        transcriptionsToKeep.add(transcription);
      }
    }

    await _saveTranscriptions(transcriptionsToKeep);

    for (final path in audioPathsToDelete) {
      try {
        final file = File(path);
        if (await file.exists()) {
          await file.delete();
        }
      } catch (e) {
        developer.log("Error deleting audio file $path: $e");
      }
    }
  }
}
