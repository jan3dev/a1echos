import 'dart:io';
import 'dart:async';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'dart:developer' as developer;
import '../constants/app_constants.dart';

class AudioService {
  final AudioRecorder _audioRecorder = AudioRecorder();
  String? _recordingPath;
  File? _currentAudioFile;
  Timer? _durationTimer;

  Future<bool> hasPermission() async {
    final status = await Permission.microphone.status;
    if (status.isGranted) {
      return true;
    }

    final result = await Permission.microphone.request();
    return result.isGranted;
  }

  Future<bool> startRecording({required bool useStreaming}) async {
    if (!await hasPermission()) {
      return false;
    }

    if (await _audioRecorder.isRecording()) {
      return true;
    }

    try {
      final tempDir = await getTemporaryDirectory();
      final fileExtension = useStreaming ? 'pcm' : 'wav';
      _recordingPath =
          '${tempDir.path}/rec_${DateTime.now().millisecondsSinceEpoch}.$fileExtension';
      _currentAudioFile = null;

      final encoder = useStreaming ? AudioEncoder.pcm16bits : AudioEncoder.wav;
      final config = RecordConfig(
        encoder: encoder,
        sampleRate: 16000,
        numChannels: 1,
      );

      if (useStreaming) {
        await _audioRecorder.startStream(config);
      } else {
        await _audioRecorder.start(config, path: _recordingPath!);
      }

      _monitorRecordingDuration();

      return true;
    } catch (e, stackTrace) {
      developer.log(
        'Error starting recording: $e',
        name: 'AudioService',
        error: e,
        stackTrace: stackTrace,
      );
      await _cleanup();
      return false;
    }
  }

  void _monitorRecordingDuration() {
    _durationTimer?.cancel();
    final startTime = DateTime.now();

    _durationTimer = Timer.periodic(AppConstants.recordingCheckInterval, (
      timer,
    ) async {
      if (!await _audioRecorder.isRecording()) {
        timer.cancel();
        return;
      }
      final elapsed = DateTime.now().difference(startTime);
      if (elapsed >= AppConstants.recordingMaxDuration) {
        await stopRecording();
        timer.cancel();
      }
    });
  }

  Future<File?> stopRecording() async {
    _durationTimer?.cancel();
    if (!await _audioRecorder.isRecording()) {
      return _currentAudioFile?.existsSync() == true ? _currentAudioFile : null;
    }

    File? recordedFile;
    try {
      final path = await _audioRecorder.stop();
      if (path != null) {
        _recordingPath = path;
        await Future.delayed(const Duration(milliseconds: 300));
        final file = File(_recordingPath!);
        if (await file.exists()) {
          _currentAudioFile = file;
          recordedFile = _currentAudioFile;
        }
      }
    } catch (e, stackTrace) {
      developer.log(
        'Error stopping recording: $e',
        name: 'AudioService',
        error: e,
        stackTrace: stackTrace,
      );
      recordedFile = null;
    }
    return recordedFile;
  }

  Future<bool> isRecording() async {
    return await _audioRecorder.isRecording();
  }

  Future<void> _cleanup() async {
    _durationTimer?.cancel();
    if (await _audioRecorder.isRecording()) {
      await _audioRecorder.stop();
    }
  }

  Future<void> dispose() async {
    await _cleanup();
    await _audioRecorder.dispose();
  }
}
