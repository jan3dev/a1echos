import 'dart:convert';
import 'dart:io';

import 'package:synchronized/synchronized.dart';
import 'package:path_provider/path_provider.dart';

import 'encryption_service.dart';
import '../models/transcription.dart';
import '../logger.dart';

class StorageService {
  static const String _fileName = 'transcriptions.json';
  static const String _pendingDeletesFileName = 'pending_deletes.json';

  final _lock = Lock();

  Future<String> get _localPath async {
    final directory = await getApplicationDocumentsDirectory();
    return directory.path;
  }

  Future<File> get _localFile async {
    final path = await _localPath;
    return File('$path/$_fileName');
  }

  Future<File> get _pendingDeletesFile async {
    final path = await _localPath;
    return File('$path/$_pendingDeletesFileName');
  }

  /// Loads the list of file paths that previously failed to delete.
  Future<List<String>> _loadPendingDeletes() async {
    final file = await _pendingDeletesFile;
    if (!await file.exists()) return [];

    try {
      final contents = await file.readAsString();
      if (contents.isEmpty) return [];
      final List<dynamic> jsonList = json.decode(contents);
      return jsonList.cast<String>();
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.storage,
        message: 'Failed to read pending deletes file. It may be corrupt.',
      );
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final backupPath = '${file.path}.corrupted.$timestamp';
      try {
        await file.rename(backupPath);
        logger.info(
          'Corrupted pending deletes file backed up to $backupPath',
          flag: FeatureFlag.storage,
        );
      } catch (renameError, renameSt) {
        logger.error(
          renameError,
          stackTrace: renameSt,
          flag: FeatureFlag.storage,
          message:
              'Failed to rename corrupted pending deletes file to $backupPath',
        );
      }
      return [];
    }
  }

  Future<void> _savePendingDeletes(List<String> list) async {
    final file = await _pendingDeletesFile;
    try {
      if (list.isEmpty) {
        if (await file.exists()) {
          await file.delete();
        }
        return;
      }
      final rawJson = json.encode(list);
      await file.writeAsString(rawJson);
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.storage,
        message: 'Failed to save pending deletes to ${file.path}',
      );
      rethrow;
    }
  }

  /// Attempts to delete any files that failed to delete previously.
  Future<void> processPendingDeletes() async {
    final pending = await _loadPendingDeletes();
    if (pending.isEmpty) return;

    final List<String> stillPending = [];

    for (final path in pending) {
      var success = false;
      try {
        final file = File(path);
        if (await file.exists()) {
          await file.delete();
        }
        success = true;
      } catch (e, st) {
        logger.error(
          e,
          stackTrace: st,
          flag: FeatureFlag.storage,
          message: 'Error deleting file $path, attempting overwrite',
        );
        try {
          final file = File(path);
          if (await file.exists()) {
            await file.writeAsBytes([]);
            await file.delete();
          }
          success = true;
        } catch (e2, st2) {
          logger.error(
            e2,
            stackTrace: st2,
            flag: FeatureFlag.storage,
            message: 'Second attempt failed deleting file $path',
          );
        }
      }

      if (!success) {
        stillPending.add(path);
      }
    }

    await _savePendingDeletes(stillPending);
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
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.storage,
        message: 'Error decrypting or parsing transcriptions',
      );
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
      } catch (e, st) {
        logger.error(
          e,
          stackTrace: st,
          flag: FeatureFlag.storage,
          message: 'Error deleting audio file $path',
        );
        bool deletionStillPending = false;
        try {
          final file = File(path);
          if (await file.exists()) {
            // Overwrite the file with empty bytes before attempting deletion again.
            await file.writeAsBytes([]);
            await file.delete();
          }
        } catch (e2, st2) {
          logger.error(
            e2,
            stackTrace: st2,
            flag: FeatureFlag.storage,
            message: 'Second deletion attempt failed for $path',
          );
          deletionStillPending = true;
        }

        if (deletionStillPending) {
          // Use a lock to ensure that the read-modify-write operation is atomic.
          await _lock.synchronized(() async {
            // Persist the path so we can retry later.
            final pending = await _loadPendingDeletes();
            if (!pending.contains(path)) {
              pending.add(path);
              await _savePendingDeletes(pending);
            }
          });
        }
      }
    }
  }
}
