import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import '../models/transcription.dart';

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

  Future<List<Transcription>> getTranscriptions() async {
    try {
      final file = await _localFile;
      if (!await file.exists()) {
        return [];
      }

      final contents = await file.readAsString();
      if (contents.isEmpty) {
        return [];
      }

      final List<dynamic> jsonList = json.decode(contents);
      return jsonList.map((json) => Transcription.fromJson(json)).toList();
    } catch (e) {
      return [];
    }
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

  Future<void> _saveTranscriptions(List<Transcription> transcriptions) async {
    final file = await _localFile;
    final jsonList = transcriptions.map((item) => item.toJson()).toList();
    await file.writeAsString(json.encode(jsonList));
  }

  Future<String> saveAudioFile(File audioFile, String fileName) async {
    final directory = await getApplicationDocumentsDirectory();
    final path = '${directory.path}/audio';
    await Directory(path).create(recursive: true);

    final targetFile = File('$path/$fileName');
    await audioFile.copy(targetFile.path);

    return targetFile.path;
  }
}
