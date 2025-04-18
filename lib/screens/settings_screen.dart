import 'package:flutter/material.dart';
import '../services/model_service.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final ModelService _modelService = ModelService();
  bool _isLoading = true;
  bool _isModelInitialized = false;
  String _modelError = '';

  @override
  void initState() {
    super.initState();
    _checkModelStatus();
  }

  Future<void> _checkModelStatus() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final isInstalled = await _modelService.isModelInstalled();
      
      if (isInstalled) {
        await _modelService.getModelPath();
        setState(() {
          _isModelInitialized = true;
          _modelError = '';
        });
      } else {
        setState(() {
          _isModelInitialized = false;
          _modelError = '';
        });
      }
    } catch (e) {
      setState(() {
        _isModelInitialized = false;
        _modelError = e.toString();
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body:
          _isLoading
              ? const Center(child: CircularProgressIndicator())
              : Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Speech Recognition Status',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'The app uses Vosk for offline speech recognition. No internet connection is required for transcription.',
                    ),
                    const SizedBox(height: 16),
                    if (_isModelInitialized) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.green.withValues(),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.green),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.check_circle, color: Colors.green),
                                const SizedBox(width: 8),
                                Text(
                                  'Model Ready',
                                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                    color: Colors.green,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text('Using: English (US) - Small Model'),
                          ],
                        ),
                      ),
                    ] else ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.orange.withValues(),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.orange),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.warning, color: Colors.orange),
                                const SizedBox(width: 8),
                                Text(
                                  'Model Not Ready',
                                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                    color: Colors.orange,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                            if (_modelError.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Text(
                                _modelError,
                                style: const TextStyle(color: Colors.red),
                              ),
                            ],
                            const SizedBox(height: 8),
                            const Text(
                              'Please restart the app to initialize the speech recognition model.',
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 24),
                    const Text(
                      'About Speech Recognition',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      '• All transcription processing happens on your device\n'
                      '• No internet connection required\n'
                      '• Works best in quiet environments\n'
                      '• Optimized for English (US) speech'
                    ),
                  ],
                ),
              ),
    );
  }
}

