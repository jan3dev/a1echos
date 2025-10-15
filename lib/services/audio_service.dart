import 'dart:async';
import 'dart:io';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'package:permission_handler/permission_handler.dart';
import 'native_audio_permission_service.dart';
import '../logger.dart';
import 'background_recording_service.dart';

class AudioService {
  Future<List<String>> _getAllowedDirectories() async {
    final tempDir = await getTemporaryDirectory();
    final docDir = await getApplicationDocumentsDirectory();
    return [tempDir.path, docDir.path];
  }

  Future<bool> _isPathAllowed(String path) async {
    final allowedDirs = await _getAllowedDirectories();
    for (final dir in allowedDirs) {
      if (p.equals(dir, path) || p.isWithin(dir, path)) {
        return true;
      }
    }
    return false;
  }

  final AudioRecorder _recorder = AudioRecorder();
  final BackgroundRecordingService _backgroundService =
      BackgroundRecordingService.instance;
  String? _recordingPath;
  File? _currentAudioFile;
  bool _backgroundServiceInitialized = false;
  bool _isMonitoring = false;
  String? _monitorTempPath;
  DateTime? _recordStart;

  Future<bool> hasPermission() async {
    if (Platform.isIOS) {
      return await NativeAudioPermissionService.ensureRecordPermission();
    }

    final status = await Permission.microphone.status;
    if (status.isGranted) {
      return true;
    }

    if (status.isPermanentlyDenied) {
      throw Exception(
        'Microphone permission permanently denied. Please enable it in Settings.',
      );
    }

    final result = await Permission.microphone.request();

    if (result.isGranted) {
      return true;
    }

    if (result.isPermanentlyDenied) {
      throw Exception(
        'Microphone permission permanently denied. Please enable it in Settings.',
      );
    }

    return false;
  }

  Future<String> _generateRecordingPath({String extension = 'wav'}) async {
    final tempDir = await getTemporaryDirectory();
    final ts = DateTime.now().millisecondsSinceEpoch;
    final proposedPath = '${tempDir.path}/rec_$ts.$extension';

    if (!await _isPathAllowed(proposedPath)) {
      throw Exception(
        'Attempted to generate recording path outside of allowed directories',
      );
    }

    return proposedPath;
  }

  Future<bool> startRecording({bool useStreaming = false}) async {
    if (!await hasPermission()) {
      throw Exception('Microphone permission denied');
    }

    if (!_backgroundServiceInitialized) {
      try {
        await _backgroundService.initialize();

        _backgroundService.setOnStopRecordingCallback(() async {
          await stopRecording();
        });

        _backgroundServiceInitialized = true;
      } catch (e, stackTrace) {
        logger.error(
          'Background service initialization failed: $e',
          stackTrace: stackTrace,
          flag: FeatureFlag.service,
        );
      }
    }

    try {
      final success = await _backgroundService.startBackgroundService();
      if (!success) {
        logger.error(
          'Background service failed to start',
          flag: FeatureFlag.service,
        );
      }
    } catch (e, stackTrace) {
      logger.error(
        'Failed to start background service: $e',
        stackTrace: stackTrace,
        flag: FeatureFlag.service,
      );
    }

    await _cleanup();

    _recordingPath = await _generateRecordingPath();

    try {
      const config = RecordConfig(
        encoder: AudioEncoder.wav,
        sampleRate: 16000,
        bitRate: 128000,
        numChannels: 1,
      );

      await _recorder.start(config, path: _recordingPath!);
      _recordStart = DateTime.now();

      _startAmplitudeMonitoring();

      return true;
    } catch (e) {
      try {
        await _recorder.stop();
      } catch (_) {}
      return Future.error(e);
    }
  }

  /// Starts monitoring levels without creating a persistent audio file.
  Future<bool> startMonitoring() async {
    if (!await hasPermission()) {
      throw Exception('Microphone permission denied');
    }

    if (await _recorder.isRecording()) {
      return true;
    }

    try {
      const config = RecordConfig(
        encoder: AudioEncoder.wav,
        sampleRate: 16000,
        bitRate: 128000,
        numChannels: 1,
      );

      _monitorTempPath = await _generateRecordingPath();

      await _recorder.start(config, path: _monitorTempPath!);
      _isMonitoring = true;

      _startAmplitudeMonitoring();

      return true;
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.recording,
        message: 'Error starting file recording',
      );
      return false;
    }
  }

  void _startAmplitudeMonitoring() {
    _amplitudeSubscription?.cancel();

    _amplitudeSubscription = _recorder
        .onAmplitudeChanged(const Duration(milliseconds: 16))
        .listen((amplitude) {
          _handleAmplitudeEvent(amplitude);
        });
  }

  /// Stops monitoring levels and cleans up any temporary file created.
  Future<void> stopMonitoring() async {
    if (!_isMonitoring) return;

    try {
      if (await _recorder.isRecording()) {
        await _recorder.stop();
      }
    } catch (_) {}

    await _amplitudeSubscription?.cancel();
    _amplitudeSubscription = null;
    _isMonitoring = false;

    if (_monitorTempPath != null) {
      try {
        final f = File(_monitorTempPath!);
        if (await f.exists()) await f.delete();
      } catch (_) {}
      _monitorTempPath = null;
    }
  }

  Future<File?> stopRecording() async {
    _backgroundService.updateRecordingState(false);

    try {
      await _backgroundService.stopBackgroundService();
    } catch (e, stackTrace) {
      logger.error(
        'Failed to stop background service: $e',
        stackTrace: stackTrace,
        flag: FeatureFlag.service,
      );
    }

    final isCurrentlyRecording = await _recorder.isRecording();

    if (!isCurrentlyRecording) {
      await _amplitudeSubscription?.cancel();
      _amplitudeSubscription = null;
      return _currentAudioFile;
    }

    try {
      final startedAt = _recordStart ?? DateTime.now();
      final elapsedMs = DateTime.now().difference(startedAt).inMilliseconds;
      const int minMs = 250;
      final int waitMs = elapsedMs >= minMs ? 0 : (minMs - elapsedMs);
      if (waitMs > 0) {
        await Future.delayed(Duration(milliseconds: waitMs));
      }
    } catch (_) {}

    File? recordedFile;
    try {
      final String? path = await _recorder.stop();
      if (path != null && !await _isPathAllowed(path)) {
        throw Exception('Recording saved to disallowed directory');
      }

      if (path != null) {
        final file = File(path);
        if (await file.exists()) {
          final fileSize = await file.length();
          if (fileSize > 1024) {
            recordedFile = file;
          }
        }
      }
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.recording,
        message: 'Error stopping recording',
      );
      recordedFile = null;
    }

    await _amplitudeSubscription?.cancel();
    _amplitudeSubscription = null;
    _recordStart = null;

    _currentAudioFile = recordedFile;
    return recordedFile;
  }

  Future<bool> isRecording() async {
    return await _recorder.isRecording();
  }

  Future<void> _cleanup() async {
    if (await _recorder.isRecording()) {
      await _recorder.stop();
    }
    await _amplitudeSubscription?.cancel();
    _amplitudeSubscription = null;
    _currentAudioFile = null;
    _resetLevelState();
  }

  final StreamController<double> _audioLevelController =
      StreamController.broadcast();
  Stream<double> get audioLevelStream => _audioLevelController.stream;

  StreamSubscription<Amplitude>? _amplitudeSubscription;

  double _smoothedLevel = 0.0;
  DateTime? _lastUpdateTime;

  void _resetLevelState() {
    _smoothedLevel = 0.0;
    _lastUpdateTime = null;
  }

  void _handleAmplitudeEvent(Amplitude amplitude) {
    double level = 0.02;

    if (amplitude.current.isFinite && amplitude.current > -160) {
      final double db = amplitude.current.clamp(-60.0, -10.0);
      level = ((db - (-60.0)) / ((-10.0) - (-60.0))).clamp(0.0, 1.0);

      level = level * level;
      level = level.clamp(0.02, 1.0);
    }

    final now = DateTime.now();
    final int dtMs = _lastUpdateTime == null
        ? 16
        : now.difference(_lastUpdateTime!).inMilliseconds.clamp(0, 150);
    _lastUpdateTime = now;

    final bool rising = level > _smoothedLevel;
    final double baseAlpha = rising ? 0.6 : 0.2;
    final double alpha = (baseAlpha * (dtMs / 16.0)).clamp(
      0.2,
      rising ? 0.8 : 0.3,
    );
    _smoothedLevel = _smoothedLevel + (level - _smoothedLevel) * alpha;

    double visual = _smoothedLevel.clamp(0.02, 1.0);
    _emitVisual(visual);
  }

  void _emitVisual(double v) {
    _audioLevelController.add(v);
  }

  Future<void> dispose() async {
    try {
      await _amplitudeSubscription?.cancel();
      _amplitudeSubscription = null;
      if (await _recorder.isRecording()) {
        await _recorder.stop();
      }
      await _recorder.dispose();
    } catch (_) {}
    try {
      await _audioLevelController.close();
    } catch (_) {}
  }
}
