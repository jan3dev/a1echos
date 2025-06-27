import 'dart:io';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'native_audio_permission_service.dart';

class AudioService {
  final AudioRecorder _audioRecorder = AudioRecorder();
  String? _recordingPath;
  File? _currentAudioFile;

  Future<bool> hasPermission() async {
    if (Platform.isIOS) {
      return await NativeAudioPermissionService.ensureRecordPermission();
    }

    final status = await Permission.microphone.status;

    if (status.isGranted) {
      return true;
    }

    if (status.isDenied) {
      final result = await Permission.microphone.request();
      return result.isGranted;
    }

    if (status.isPermanentlyDenied) {
      return false;
    }

    return false;
  }

  Future<String> _generateRecordingPath() async {
    final tempDir = await getTemporaryDirectory();
    return '${tempDir.path}/rec_${DateTime.now().millisecondsSinceEpoch}.m4a';
  }

  Future<bool> startRecording({bool useStreaming = false}) async {
    if (!await hasPermission()) {
      throw Exception('Microphone permission denied');
    }

    await _cleanup();

    _recordingPath = await _generateRecordingPath();

    if (useStreaming) {
      await _audioRecorder.startStream(
        RecordConfig(
          encoder: AudioEncoder.pcm16bits,
          sampleRate: 16000,
          numChannels: 1,
        ),
      );
    } else {
      final encoders = [
        AudioEncoder.wav,
        AudioEncoder.flac,
        AudioEncoder.aacLc,
      ];

      bool recordingStarted = false;

      for (final encoder in encoders) {
        try {
          final success = await _startFileRecording(encoder);
          if (success) {
            recordingStarted = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!recordingStarted) {
        throw Exception('Failed to start recording with any encoder');
      }
    }

    return true;
  }

  Future<bool> _startFileRecording(AudioEncoder encoder) async {
    try {
      final config = RecordConfig(
        encoder: encoder,
        sampleRate: 16000,
        bitRate: 128000,
        numChannels: 1,
      );

      await _audioRecorder.start(config, path: _recordingPath!);

      await Future.delayed(const Duration(milliseconds: 500));
      final isRecording = await _audioRecorder.isRecording();

      if (!isRecording) {
        return false;
      }

      return true;
    } catch (e) {
      return false;
    }
  }

  Future<File?> stopRecording() async {
    final isCurrentlyRecording = await _audioRecorder.isRecording();

    if (!isCurrentlyRecording) {
      if (_recordingPath != null) {
        final existingFile = File(_recordingPath!);
        if (await existingFile.exists()) {
          final size = await existingFile.length();
          return size > 0 ? existingFile : null;
        }
      }
      return _currentAudioFile;
    }

    File? recordedFile;

    try {
      final path = await _audioRecorder.stop();

      if (path != null) {
        if (path != _recordingPath) {
          _recordingPath = path;
        }

        final file = File(_recordingPath!);

        final fileExists = await file.exists();

        if (fileExists) {
          final fileSize = await file.length();

          if (fileSize > 0) {
            recordedFile = file;
          } else {
            recordedFile = null;
          }
        } else {
          recordedFile = null;
        }
      } else {
        recordedFile = null;
      }
    } catch (e) {
      recordedFile = null;
    }

    return recordedFile;
  }

  Future<bool> isRecording() async {
    return await _audioRecorder.isRecording();
  }

  Future<void> _cleanup() async {
    if (await _audioRecorder.isRecording()) {
      await _audioRecorder.stop();
    }
  }

  Future<void> dispose() async {
    await _cleanup();
    await _audioRecorder.dispose();
  }
}
