import 'dart:io';
import 'dart:typed_data';
import 'dart:async';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'dart:developer' as developer;

class AudioService {
  final _audioRecorder = AudioRecorder();
  RecordConfig? _recordConfig;
  String? _recordingPath;
  DateTime? _recordingStartTime;
  File? _currentAudioFile;
  static const int _maxRecordingDurationSeconds = 180;
  
  // Create a StreamController for streaming audio data
  StreamController<Uint8List>? _audioStreamController;
  Stream<Uint8List>? get audioStream => _audioStreamController?.stream;
  bool _isStreamingMode = false;

  Future<bool> hasPermission() async {
    final status = await Permission.microphone.status;
    if (status.isGranted) {
      return true;
    }

    final result = await Permission.microphone.request();
    return result.isGranted;
  }

  Future<bool> startRecording({bool streamAudio = false}) async {
    if (!await hasPermission()) {
      return false;
    }

    try {
      final tempDir = await getTemporaryDirectory();
      _recordingPath =
          '${tempDir.path}/audio_${DateTime.now().millisecondsSinceEpoch}.m4a';
      _recordingStartTime = DateTime.now();

      // Use a higher quality configuration for better audio capture
      _recordConfig = RecordConfig(
        encoder: streamAudio ? AudioEncoder.pcm16bits : AudioEncoder.aacLc,
        bitRate: 256000,
        sampleRate: 16000, // 16kHz is optimal for speech recognition
        numChannels: 1, // Mono recording is sufficient for speech
      );

      _isStreamingMode = streamAudio;
      
      if (streamAudio) {
        // Create a StreamController for audio data
        _audioStreamController = StreamController<Uint8List>.broadcast();
        
        // Set up a real-time processing approach using a timer
        // This is a workaround since direct streaming may not be available
        await _audioRecorder.start(_recordConfig!, path: _recordingPath!);
        _startAudioStreamSimulation();
      } else {
        // Start file recording mode
        await _audioRecorder.start(_recordConfig!, path: _recordingPath!);
        _monitorRecordingDuration();
      }

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
  
  // Simulate audio streaming by reading chunks of PCM data
  void _startAudioStreamSimulation() {
    // Process audio every 100ms to simulate streaming
    Timer.periodic(const Duration(milliseconds: 100), (timer) async {
      if (!_isStreamingMode || _audioStreamController == null || 
          _audioStreamController!.isClosed || !(await _audioRecorder.isRecording())) {
        timer.cancel();
        return;
      }
      
      // For real implementations, you would get audio data from the recorder
      // This is just a placeholder - in a real implementation, you would
      // need native code to access raw audio buffers
      final dummyData = Uint8List(1600); // 100ms of 16kHz 16-bit mono audio
      
      _audioStreamController?.add(dummyData);
    });
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
            await startRecording(streamAudio: _isStreamingMode);
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
      
      // Close the stream controller if in streaming mode
      if (_isStreamingMode && _audioStreamController != null) {
        await _audioStreamController?.close();
        _audioStreamController = null;
        _isStreamingMode = false;
        return null; // No file is created in streaming mode
      }

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
    await stopRecording();
    await _audioRecorder.dispose();
  }
}
