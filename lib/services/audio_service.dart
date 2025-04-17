import 'dart:io';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'dart:developer' as developer;

class AudioService {
  final _audioRecorder = AudioRecorder();
  String? _recordingPath;
  DateTime? _recordingStartTime;
  File? _currentAudioFile;
  static const int _maxRecordingDurationSeconds = 180;

  Future<bool> hasPermission() async {
    final status = await Permission.microphone.status;
    if (status.isGranted) {
      return true;
    }

    final result = await Permission.microphone.request();
    return result.isGranted;
  }

  Future<bool> startRecording() async {
    if (!await hasPermission()) {
      return false;
    }

    try {
      final tempDir = await getTemporaryDirectory();
      _recordingPath =
          '${tempDir.path}/audio_${DateTime.now().millisecondsSinceEpoch}.m4a';
      _recordingStartTime = DateTime.now();

      // Use a higher quality configuration for better audio capture
      final config = RecordConfig(
        encoder: AudioEncoder.aacLc, // AAC encoder for better quality
        bitRate: 192000, // Higher bitrate for better quality
        sampleRate: 48000, // Higher sample rate
        numChannels:
            1, // Mono recording is sufficient for speech and saves file size
      );

      await _audioRecorder.start(config, path: _recordingPath!);

      _monitorRecordingDuration();

      return true;
    } catch (e) {
      developer.log(
        'Error starting recording: $e',
        name: 'AudioService',
        error: e,
      );
      return false;
    }
  }

  void _monitorRecordingDuration() {
    // Check recording duration every 5 seconds
    Future.delayed(const Duration(seconds: 5), () async {
      if (await _audioRecorder.isRecording()) {
        final now = DateTime.now();
        final duration = now.difference(_recordingStartTime!);

        // If recording exceeds max duration, stop current chunk and start a new one
        if (duration.inSeconds >= _maxRecordingDurationSeconds) {
          _currentAudioFile = await _stopCurrentChunk();
          if (_currentAudioFile != null) {
            await startRecording();
          }
        } else {
          _monitorRecordingDuration();
        }
      }
    });
  }

  Future<File?> _stopCurrentChunk() async {
    try {
      await _audioRecorder.stop();
      if (_recordingPath == null) {
        return null;
      }

      // Add a small delay to ensure file is properly written
      await Future.delayed(const Duration(milliseconds: 300));
      final file = File(_recordingPath!);
      return file;
    } catch (e) {
      developer.log('Error stopping chunk: $e', name: 'AudioService', error: e);
      return null;
    }
  }

  Future<File?> stopRecording() async {
    try {
      final isRecording = await _audioRecorder.isRecording();

      if (!isRecording) {
        return _currentAudioFile;
      }

      await _audioRecorder.stop();

      if (_recordingPath == null) {
        return null;
      }

      // Add a small delay to ensure file is properly written
      await Future.delayed(const Duration(milliseconds: 500));

      final audioFile = File(_recordingPath!);

      if (await audioFile.exists()) {
        // If we have previous chunks, merge them with the current one
        if (_currentAudioFile != null && await audioFile.exists()) {
          return audioFile;
        }

        return audioFile;
      } else {
        return null;
      }
    } catch (e) {
      developer.log(
        'Error stopping recording: $e',
        name: 'AudioService',
        error: e,
      );
      return null;
    }
  }

  Future<bool> isRecording() async {
    return await _audioRecorder.isRecording();
  }

  Future<void> dispose() async {
    await _audioRecorder.dispose();
  }
}
