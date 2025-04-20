import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/local_transcription_provider.dart';
import '../services/model_service.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: Consumer<LocalTranscriptionProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading) {
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
                _buildModelStatusWidget(context, provider),
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

  Widget _buildModelStatusWidget(
    BuildContext context,
    LocalTranscriptionProvider provider,
  ) {
    final theme = Theme.of(context);
    final modelName =
        provider.selectedModelType == ModelType.vosk
            ? 'Vosk (Small EN)'
            : 'Whisper (Base EN)';

    if (provider.isModelReady) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.green.shade50,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.green.shade300),
        ),
        child: Row(
          children: [
            Icon(Icons.check_circle, color: Colors.green.shade700),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                '$modelName model is ready.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: Colors.green.shade900,
                ),
              ),
            ),
          ],
        ),
      );
    } else if (provider.error != null) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.red.shade50,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.red.shade300),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.error, color: Colors.red.shade700),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$modelName model failed to initialize.',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: Colors.red.shade900,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    provider.error!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: Colors.red.shade800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Please ensure model files are correctly placed in assets and restart the app.',
                    style: TextStyle(fontSize: 12),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    } else {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.blue.shade50,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.blue.shade300),
        ),
        child: Row(
          children: [
            const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Initializing $modelName model...',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: Colors.blue.shade900,
                ),
              ),
            ),
          ],
        ),
      );
    }
  }
}
