import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiService {
  static const String _baseUrl = 'https://api.openai.com/v1';
  static const String _apiKeyStorageKey = 'openai_api_key';
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  static const int _maxFileSize =
      24 * 1024 * 1024; // 24MB to be safe (API limit is 25MB)

  Future<String?> getApiKey() async {
    return await _secureStorage.read(key: _apiKeyStorageKey);
  }

  Future<void> saveApiKey(String apiKey) async {
    await _secureStorage.write(key: _apiKeyStorageKey, value: apiKey);
  }

  Future<bool> hasApiKey() async {
    final apiKey = await getApiKey();
    return apiKey != null && apiKey.isNotEmpty;
  }

  Future<void> deleteApiKey() async {
    await _secureStorage.delete(key: _apiKeyStorageKey);
  }

  Future<String> transcribeAudio(File audioFile) async {
    final apiKey = await getApiKey();
    if (apiKey == null || apiKey.isEmpty) {
      throw Exception(
        'API key not found. Please add your OpenAI API key in settings.',
      );
    }

    final fileSize = await audioFile.length();

    if (fileSize > _maxFileSize) {
      // For large files, we could implement file splitting here
      // For now, throw an error
      throw Exception(
        'Audio file is too large (${(fileSize / 1024 / 1024).toStringAsFixed(2)}MB). Maximum size is 24MB.',
      );
    }

    if (!await audioFile.exists()) {
      throw Exception('Audio file does not exist: ${audioFile.path}');
    }

    var request = http.MultipartRequest(
      'POST',
      Uri.parse('$_baseUrl/audio/transcriptions'),
    );

    request.headers.addAll({'Authorization': 'Bearer $apiKey'});

    request.fields['model'] = 'whisper-1';
    request.fields['response_format'] = 'verbose_json';

    request.fields['temperature'] = '0.0';

    request.fields['prompt'] =
        'This is a short recording containing a few sentences.';

    try {
      request.files.add(
        await http.MultipartFile.fromPath('file', audioFile.path),
      );

      final response = await request.send();
      final responseData = await response.stream.bytesToString();

      if (response.statusCode == 200) {
        final jsonData = json.decode(responseData);

        if (jsonData['text'] == null || jsonData['text'].isEmpty) {
          return 'No speech detected. Please try recording again.';
        }

        return jsonData['text'];
      } else {
        throw Exception(
          'Failed to transcribe audio: ${response.statusCode} - $responseData',
        );
      }
    } catch (e) {
      throw Exception('Error during transcription: $e');
    }
  }

  // Future method for handling larger transcriptions by splitting files
  // This would be implemented in a future version
  Future<String> transcribeLargeAudio(List<File> audioChunks) async {
    // Combine texts from multiple chunk transcriptions
    final List<String> transcriptions = [];

    for (final chunk in audioChunks) {
      final text = await transcribeAudio(chunk);
      transcriptions.add(text);
    }

    return transcriptions.join(' ');
  }

  int min(int a, int b) {
    return a < b ? a : b;
  }
}
