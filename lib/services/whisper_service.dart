import 'dart:async';
import 'dart:io';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;
import 'package:whisper_flutter_new/whisper_flutter_new.dart' as fwn;
import 'package:flutter_whisper_kit/flutter_whisper_kit.dart' as kit;
import 'package:archive/archive.dart';
import '../logger.dart';

/// A service that abstracts Whisper functionality for both Android (whisper_flutter_new)
/// and iOS (flutter_whisper_kit) back-ends.
class WhisperService {
  // Android implementation --------------------------------------------------
  fwn.Whisper? _androidWhisper;

  // iOS implementation ------------------------------------------------------
  kit.FlutterWhisperKit? _iosKit;

  // =========================================================================
  // iOS-SPECIFIC MODEL PREPARATION HELPERS
  // =========================================================================

  /// Ensures the Core ML model for the given [variant] is available in the
  /// directory WhisperKit expects: Application Support/WhisperKitModels/[variant].
  /// If the directory is missing, the assets bundled with the app are copied
  /// there. Returns the absolute path to the model directory.
  Future<String> _prepareIOSModel(String zipAssetPath, String variant) async {
    final support = await getApplicationSupportDirectory();
    final destDir = path.join(support.path, 'WhisperKitModels', variant);

    // Already unpacked?
    if (await Directory(
      path.join(destDir, 'MelSpectrogram.mlmodelc'),
    ).exists()) {
      return destDir;
    }

    // Ensure fresh dir
    final dir = Directory(destDir);
    if (await dir.exists()) await dir.delete(recursive: true);
    await dir.create(recursive: true);

    // Copy zip from assets to temp file
    final bytes = await rootBundle.load(zipAssetPath);
    final tmpZip = File(path.join(dir.parent.path, '$variant.zip'));
    await tmpZip.writeAsBytes(bytes.buffer.asUint8List());

    // Unzip
    final archiveBytes = await tmpZip.readAsBytes();
    final archive = ZipDecoder().decodeBytes(archiveBytes);
    for (final file in archive) {
      // Skip macOS resource-fork files
      if (file.name.startsWith('__MACOSX/')) continue;

      String relative = file.name;
      if (relative.startsWith('$variant/')) {
        relative = relative.substring(variant.length + 1);
      }
      if (relative.isEmpty) {
        // This was the root directory entry; skip.
        continue;
      }

      final String outPath = path.join(destDir, relative);

      if (file.isFile) {
        final outFile = File(outPath);
        await outFile.parent.create(recursive: true);
        await outFile.writeAsBytes(file.content as List<int>);
      } else {
        await Directory(outPath).create(recursive: true);
      }
    }
    await tmpZip.delete();

    return destDir;
  }

  // Realtime streaming support (iOS)
  StreamSubscription<dynamic>? _iosPartialSub;
  final StreamController<String> _partialController =
      StreamController<String>.broadcast();

  /// Stream of partial transcription results (only emitted during real-time recording).
  Stream<String> get onPartial => _partialController.stream;

  bool _isInitialized = false;
  bool _isInitializing = false;
  bool _isTranscribing = false;
  bool _isRealtimeRecording = false;
  String _currentTranscription = '';
  String? _initializationStatus;

  /// Returns whether the service has been successfully initialized.
  bool get isInitialized => _isInitialized;

  /// Returns whether a transcription is currently in progress.
  bool get isTranscribing => _isTranscribing;

  /// Returns the current initialization status message.
  String? get initializationStatus => _initializationStatus;

  // =========================================================================
  // LOCAL MODEL ASSET MANAGEMENT
  // =========================================================================

  /// Copies the tiny GGML model to a writable app directory if needed and
  /// returns the **full path** to the model file. Extracts the bundled
  /// `ggml-tiny.bin.zip` asset.
  Future<String> _prepareAndroidModel() async {
    final Directory documents = await getApplicationDocumentsDirectory();
    final String modelDir = path.join(documents.path, 'whisper_models');
    final String modelPath = path.join(modelDir, 'ggml-tiny.bin');

    await Directory(modelDir).create(recursive: true);

    final File modelFile = File(modelPath);
    if (await modelFile.exists()) {
      final len = await modelFile.length();
      if (len > 30 * 1024 * 1024) {
        return modelPath;
      }
      await modelFile.delete();
    }

    const String zipAsset = 'assets/models/whisper/android/ggml-tiny.bin.zip';
    try {
      final ByteData zipBytes = await rootBundle.load(zipAsset);
      final Archive archive = ZipDecoder().decodeBytes(
        zipBytes.buffer.asUint8List(),
      );
      for (final ArchiveFile file in archive) {
        if (file.isFile && file.name.endsWith('ggml-tiny.bin')) {
          await modelFile.writeAsBytes(file.content as List<int>);
          return modelPath;
        }
      }
      logger.error(
        'ggml-tiny.bin not found inside Android asset zip',
        flag: FeatureFlag.service,
      );
      throw Exception('ggml-tiny.bin not found inside zip');
    } catch (e, st) {
      logger.error(e, stackTrace: st, flag: FeatureFlag.service);
      throw Exception('Failed to prepare Whisper model: $e');
    }
  }

  // =========================================================================
  // INITIALIZATION
  // =========================================================================

  Future<bool> initialize() async {
    if (_isInitialized) return true;
    if (_isInitializing) return false;

    _isInitializing = true;
    _initializationStatus = 'Starting initialization...';

    try {
      if (Platform.isAndroid) {
        _initializationStatus = 'Loading Whisper model...';
        final String modelPath = await _prepareAndroidModel();

        _androidWhisper = fwn.Whisper(
          model: fwn.WhisperModel.tiny,
          modelDir: path.dirname(modelPath),
        );

        _initializationStatus = 'Whisper (Android) ready';
      } else if (Platform.isIOS) {
        _initializationStatus = 'Creating FlutterWhisperKit instance...';
        _iosKit = kit.FlutterWhisperKit();

        _initializationStatus = 'Preparing local CoreML model for iOS...';

        try {
          await _prepareIOSModel(
            'assets/models/whisper/ios/openai_whisper-tiny.zip',
            'openai_whisper-tiny',
          );

          _initializationStatus = 'Loading CoreML model via WhisperKit...';

          final String? loadResult = await _iosKit!.loadModel(
            'openai_whisper-tiny',
            modelRepo: null,
            redownload: false,
          );

          if (loadResult != null && loadResult.isNotEmpty) {
            _initializationStatus = 'Local CoreML model loaded successfully';
          } else {
            throw Exception('loadModel() returned an empty result');
          }
        } catch (e, st) {
          _initializationStatus =
              'Error loading local CoreML model: ${e.toString()}';
          logger.error(
            e,
            stackTrace: st,
            flag: FeatureFlag.service,
            message: _initializationStatus,
          );
          throw Exception(_initializationStatus);
        }

        _initializationStatus = 'Flutter Whisper Kit ready with local model';
      } else {
        _initializationStatus =
            'Unsupported platform for WhisperService: ${Platform.operatingSystem}';
        _isInitializing = false;
        return false;
      }

      _isInitialized = true;
      return true;
    } catch (e, st) {
      _initializationStatus = 'Initialization failed: $e';
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.service,
        message: 'Whisper initialization failed',
      );
      _resetState();
      return false;
    } finally {
      _isInitializing = false;
    }
  }

  // =========================================================================
  // FILE-BASED TRANSCRIPTION
  // =========================================================================

  Future<String?> transcribeFile(String audioPath) async {
    if (!_isInitialized) {
      throw Exception('Whisper service not initialized.');
    }
    if (_isTranscribing) {
      throw Exception('Transcription already in progress.');
    }

    final audioFile = File(audioPath);
    if (!await audioFile.exists()) {
      throw Exception('Audio file not found at: $audioPath');
    }

    try {
      _isTranscribing = true;

      if (Platform.isAndroid) {
        if (_androidWhisper == null) {
          return null;
        }

        final result = await _androidWhisper?.transcribe(
          transcribeRequest: fwn.TranscribeRequest(
            audio: audioPath,
            isTranslate: false,
            isNoTimestamps: true,
          ),
        );

        return result?.text.trim();
      } else if (Platform.isIOS) {
        final options = kit.DecodingOptions(
          task: kit.DecodingTask.transcribe,
          detectLanguage: true,
          language: null,
        );

        final transcription = await _iosKit!.transcribeFromFile(
          audioPath,
          options: options,
        );

        return transcription?.text.trim();
      } else {
        throw Exception('Unsupported platform');
      }
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.service,
        message: 'Whisper file transcription failed',
      );
      Error.throwWithStackTrace(e, st);
    } finally {
      _isTranscribing = false;
    }
  }

  // =========================================================================
  // REAL-TIME RECORDING (iOS only)
  // =========================================================================

  /// Starts real-time transcription. Returns true when recording started.
  Future<bool> startRealtimeRecording() async {
    if (!Platform.isIOS) {
      return false;
    }
    if (_iosKit == null) {
      return false;
    }
    if (!_isInitialized) {
      return false;
    }
    if (_isRealtimeRecording) {
      return false;
    }

    _currentTranscription = '';

    try {
      await _setupTranscriptionListener();

      await _iosKit!.startRecording(
        options: kit.DecodingOptions(
          task: kit.DecodingTask.transcribe,
          detectLanguage: true,
          language: null,
        ),
      );

      _isRealtimeRecording = true;
      return true;
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.model,
        message: 'Error starting realtime recording',
      );
      await _iosPartialSub?.cancel();
      _isRealtimeRecording = false;
      return false;
    }
  }

  /// Sets up the transcription stream listener
  Future<void> _setupTranscriptionListener() async {
    await _iosPartialSub?.cancel();

    try {
      _iosPartialSub = _iosKit!.transcriptionStream.listen(
        (event) {
          _handleTranscriptionEvent(event);
        },
        onError: (error) {
          logger.error(
            error,
            flag: FeatureFlag.model,
            message: 'Whisper transcription stream error',
          );
        },
        onDone: () {},
      );
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.model,
        message: 'Error setting up transcription listener',
      );
      rethrow;
    }
  }

  /// Handles transcription events from the stream
  void _handleTranscriptionEvent(dynamic event) {
    try {
      String text = '';
      if (event != null) {
        if (event.text != null) {
          text = event.text.toString().trim();
        } else {
          text = event.toString().trim();
        }
      }

      if (text.isNotEmpty) {
        _currentTranscription = text;
        _partialController.add(text);
      }
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.model,
        message: 'Error handling transcription event',
      );
      rethrow;
    }
  }

  /// Stops real-time recording and returns the final transcription.
  Future<String> stopRealtimeRecording() async {
    if (!Platform.isIOS) return '';
    if (_iosKit == null) return '';
    if (!_isRealtimeRecording) return '';

    try {
      await _iosKit!.stopRecording();
      return _currentTranscription;
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.service,
        message: 'Failed to stop real-time recording',
      );
      return _currentTranscription; // Return whatever we have
    } finally {
      _isRealtimeRecording = false;
      await _iosPartialSub?.cancel();
    }
  }

  // =========================================================================
  // CLEANUP
  // =========================================================================

  Future<void> dispose() async {
    _androidWhisper = null;
    await _iosPartialSub?.cancel();
    _iosKit = null;
    _resetState();
  }

  void _resetState() {
    _isInitialized = false;
    _isInitializing = false;
    _isTranscribing = false;
    _isRealtimeRecording = false;
  }
}
