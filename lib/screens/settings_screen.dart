import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/local_transcription_provider.dart';
import '../models/model_type.dart';
import '../widgets/model_status_tile.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: Consumer<LocalTranscriptionProvider>(
        builder: (context, provider, child) {
          if (provider.state == TranscriptionState.loading) {
            return const Center(child: CircularProgressIndicator());
          }

          return Padding(
            padding: const EdgeInsets.all(16.0),
            child: ListView(
              children: [
                const Text(
                  'Transcription Model',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Select the local model for speech recognition. All processing happens on your device.',
                ),
                const SizedBox(height: 16),

                _buildModelSelectionTile(
                  context,
                  provider,
                  ModelType.vosk,
                  'Vosk (Small EN)',
                  'Faster, real-time streaming transcription. Good for general use.',
                ),
                _buildModelSelectionTile(
                  context,
                  provider,
                  ModelType.whisper,
                  'Whisper (Base EN)',
                  'Higher accuracy, processes audio after recording stops (no streaming).',
                ),
                const SizedBox(height: 24),

                const Text(
                  'Selected Model Status',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                ModelStatusTile(
                  selectedModelType: provider.selectedModelType,
                  isModelReady: provider.isModelReady,
                  error: provider.error,
                  onRetry:
                      () => provider.changeModel(provider.selectedModelType),
                ),
                const SizedBox(height: 24),

                const Text(
                  'About Local Transcription',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  '• Processing happens entirely on your device.\n'
                  '• No internet connection is required.\n'
                  '• Performance depends on your device hardware.\n'
                  '• Ensure the required model files are present in the app assets.',
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildModelSelectionTile(
    BuildContext context,
    LocalTranscriptionProvider provider,
    ModelType modelType,
    String title,
    String subtitle,
  ) {
    return RadioListTile<ModelType>(
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w500)),
      subtitle: Text(subtitle),
      value: modelType,
      groupValue: provider.selectedModelType,
      onChanged: (ModelType? value) {
        if (value != null) {
          provider.changeModel(value);
        }
      },
      activeColor: Theme.of(context).colorScheme.primary,
      contentPadding: EdgeInsets.zero,
    );
  }
}
