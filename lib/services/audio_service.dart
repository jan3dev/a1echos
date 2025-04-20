import 'dart:io';
import 'dart:typed_data';
import 'dart:async';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'dart:developer' as developer;

class AudioService {
  final AudioRecorder _audioRecorder = AudioRecorder();
  String? _recordingPath;
  File? _currentAudioFile;
  Timer? _durationTimer;

  StreamController<Uint8List>? _audioStreamController;
  Stream<Uint8List>? get audioStream => _audioStreamController?.stream;
  bool _isCurrentlyStreaming = false;

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
      _isCurrentlyStreaming = useStreaming;

      final encoder = useStreaming ? AudioEncoder.pcm16bits : AudioEncoder.wav;
      final config = RecordConfig(
        encoder: encoder,
        sampleRate: 16000,
        numChannels: 1,
      );

      if (useStreaming) {
        _audioStreamController = StreamController<Uint8List>.broadcast();
        await _audioRecorder.startStream(config);
        _audioRecorder.onStateChanged().listen((state) {});

        _simulateStreamingForVosk();
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
      _isCurrentlyStreaming = false;
      await _cleanup();
      return false;
    }
  }

  void _simulateStreamingForVosk() {
    Timer.periodic(const Duration(milliseconds: 200), (timer) async {
      if (!_isCurrentlyStreaming ||
          _audioStreamController == null ||
          _audioStreamController!.isClosed ||
          !(await _audioRecorder.isRecording())) {
        timer.cancel();
        return;
      }
      final dummyData = Uint8List(6400);
      if (!_audioStreamController!.isClosed) {
        _audioStreamController?.add(dummyData);
      }
    });
  }

  void _monitorRecordingDuration() {
    _durationTimer?.cancel();
    const maxDuration = Duration(minutes: 5);
    final startTime = DateTime.now();

    _durationTimer = Timer.periodic(const Duration(seconds: 30), (timer) async {
      if (!await _audioRecorder.isRecording()) {
        timer.cancel();
        return;
      }
      final elapsed = DateTime.now().difference(startTime);
      if (elapsed >= maxDuration) {
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
      if (_isCurrentlyStreaming) {
        await _audioRecorder.stop();
        await _audioStreamController?.close();
        _audioStreamController = null;
      } else {
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
      }
    } catch (e, stackTrace) {
      developer.log(
        'Error stopping recording: $e',
        name: 'AudioService',
        error: e,
        stackTrace: stackTrace,
      );
      recordedFile = null;
    } finally {
      _isCurrentlyStreaming = false;
    }
    return recordedFile;
  }

  Future<bool> isRecording() async {
    return await _audioRecorder.isRecording();
  }

  Future<void> _cleanup() async {
    _durationTimer?.cancel();
    await _audioStreamController?.close();
    _audioStreamController = null;
    if (await _audioRecorder.isRecording()) {
      await _audioRecorder.stop();
    }
  }

  Future<void> dispose() async {
    await _cleanup();
    await _audioRecorder.dispose();
  }
}
