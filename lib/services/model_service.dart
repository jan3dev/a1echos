import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'dart:convert';

class ModelService {
  static const String _modelFolderName = 'vosk-model-small-en-us-0.15';
  static String _modelPath = '';
  
  // Check if model exists in the application documents directory
  Future<bool> isModelInstalled() async {
    try {
      final modelDir = await getModelDirectory();
      return await modelDir.exists() && 
             await Directory(p.join(modelDir.path, 'am')).exists() &&
             await Directory(p.join(modelDir.path, 'conf')).exists() &&
             await Directory(p.join(modelDir.path, 'ivector')).exists();
    } catch (e) {
      debugPrint('Error checking if model is installed: $e');
      return false;
    }
  }
  
  // Get the model directory
  Future<Directory> getModelDirectory() async {
    final appDir = await getApplicationDocumentsDirectory();
    return Directory(p.join(appDir.path, _modelFolderName));
  }
  
  // Get the path to the model, ensuring it's available
  Future<String> getModelPath() async {
    if (_modelPath.isNotEmpty) {
      return _modelPath;
    }
    
    // Check if model is already installed
    if (await isModelInstalled()) {
      final modelDir = await getModelDirectory();
      _modelPath = modelDir.path;
      return _modelPath;
    }
    
    // If model is not installed, extract it from assets
    final success = await _extractModelFromAssets();
    
    if (success) {
      final modelDir = await getModelDirectory();
      _modelPath = modelDir.path;
      return _modelPath;
    }
    
    throw Exception('Failed to setup Vosk model');
  }
  
  // Extract the bundled model from assets to app storage
  Future<bool> _extractModelFromAssets() async {
    try {
      debugPrint('Extracting model from assets...');
      final modelDir = await getModelDirectory();
      
      // Create the directory if it doesn't exist
      if (!await modelDir.exists()) {
        await modelDir.create(recursive: true);
      }
      
      // Get the list of files in the assets folder
      final manifestContent = await rootBundle.loadString('AssetManifest.json');
      final Map<String, dynamic> manifestMap = Map.from(
        await jsonDecode(manifestContent) as Map,
      );
      
      // Filter for files in the model directory
      final assetPaths = manifestMap.keys
          .where((String key) => key.startsWith('assets/model/$_modelFolderName/'))
          .toList();
      
      if (assetPaths.isEmpty) {
        debugPrint('No model files found in assets');
        return false;
      }
      
      // Extract each file to the app directory
      for (final assetPath in assetPaths) {
        final fileData = await rootBundle.load(assetPath);
        final relativePath = assetPath.replaceFirst('assets/model/$_modelFolderName/', '');
        final filePath = p.join(modelDir.path, relativePath);
        
        // Create subdirectories if needed
        final fileDir = Directory(p.dirname(filePath));
        if (!await fileDir.exists()) {
          await fileDir.create(recursive: true);
        }
        
        // Write the file
        final file = File(filePath);
        await file.writeAsBytes(
          fileData.buffer.asUint8List(
            fileData.offsetInBytes,
            fileData.lengthInBytes,
          ),
        );
      }
      
      debugPrint('Model extraction completed');
      return true;
    } catch (e) {
      debugPrint('Error extracting model from assets: $e');
      return false;
    }
  }
  
  // Install model from app bundle to documents directory
  Future<bool> installModelFromAssets() async {
    try {
      final modelDir = await getModelDirectory();
      
      // Create the directory if it doesn't exist
      if (!await modelDir.exists()) {
        await modelDir.create(recursive: true);
      }
      
      // This is a placeholder - to properly implement this function,
      // you would need to:
      // 1. Bundle the model with your app or provide a download URL
      // 2. Extract the model to the model directory
      
      // For now, we'll just return false, indicating the model isn't installed
      return false;
    } catch (e) {
      debugPrint('Error installing model from assets: $e');
      return false;
    }
  }
  
  // Download the model from an external URL
  Future<bool> downloadModel(String url, void Function(double)? onProgress) async {
    try {
      final modelDir = await getModelDirectory();
      
      // Create the directory if it doesn't exist
      if (!await modelDir.exists()) {
        await modelDir.create(recursive: true);
      }
      
      // This is a placeholder - to properly implement this function,
      // you would need to:
      // 1. Download the model from the URL
      // 2. Extract it to the model directory
      // 3. Call onProgress to report download progress
      
      // For now, we'll just return false, indicating the model can't be downloaded
      return false;
    } catch (e) {
      debugPrint('Error downloading model: $e');
      return false;
    }
  }

  // Guide the user to manually install the model
  String getManualInstallInstructions() {
    return '''
To manually install the Vosk model:

1. Download the model from https://alphacephei.com/vosk/models
2. Extract the zip file
3. Copy the folder to your device
4. In the app, go to Settings > Import Model and select the folder
''';
  }
} 