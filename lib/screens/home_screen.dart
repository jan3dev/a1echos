import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../providers/local_transcription_provider.dart';
import '../widgets/recording_button.dart';
import '../widgets/transcription_item.dart';
import 'settings_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Transcription App'),
        actions: [
          IconButton(
            icon: const Icon(Icons.copy_all),
            onPressed: () {
              _copyAllTranscriptions(context);
            },
            tooltip: 'Copy All',
          ),
          IconButton(
            icon: const Icon(Icons.delete_sweep),
            onPressed: () {
              _clearAllTranscriptions(context);
            },
            tooltip: 'Clear All',
          ),
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const SettingsScreen()),
              );
            },
            tooltip: 'Settings',
          ),
        ],
      ),
      body: Consumer<LocalTranscriptionProvider>(
        builder: (context, provider, child) {
          // Show streaming text while recording
          if (provider.isStreaming && provider.isRecording) {
            return Column(
              children: [
                // Live transcription area with pulsing border
                Container(
                  margin: const EdgeInsets.all(16),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: Theme.of(context).colorScheme.primary,
                      width: 2,
                    ),
                    borderRadius: BorderRadius.circular(16),
                    color:
                        Theme.of(context).colorScheme.surfaceContainerHighest,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Live Transcription',
                        style: Theme.of(
                          context,
                        ).textTheme.titleMedium?.copyWith(
                          color: Theme.of(context).colorScheme.primary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        provider.currentStreamingText.isEmpty
                            ? 'Speak now...'
                            : provider.currentStreamingText,
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                    ],
                  ),
                ),

                // Still show previous transcriptions below
                if (provider.transcriptions.isNotEmpty)
                  Expanded(
                    child: ListView.builder(
                      itemCount: provider.transcriptions.length,
                      itemBuilder: (context, index) {
                        final transcription = provider.transcriptions[index];
                        return TranscriptionItem(transcription: transcription);
                      },
                    ),
                  ),
              ],
            );
          }

          if (provider.isTranscribing) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Processing transcription...'),
                ],
              ),
            );
          }

          if (provider.error != null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: Colors.red),
                  const SizedBox(height: 16),
                  Text(
                    provider.error!,
                    style: const TextStyle(color: Colors.red),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () {
                      Provider.of<LocalTranscriptionProvider>(
                        context,
                        listen: false,
                      ).loadTranscriptions();
                    },
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          if (provider.transcriptions.isEmpty) {
            return const Center(
              child: Text(
                'No transcriptions yet. Tap the record button to start.',
              ),
            );
          }

          return ListView.builder(
            itemCount: provider.transcriptions.length,
            itemBuilder: (context, index) {
              final transcription = provider.transcriptions[index];
              return TranscriptionItem(transcription: transcription);
            },
          );
        },
      ),
      floatingActionButton: Consumer<LocalTranscriptionProvider>(
        builder: (context, provider, _) {
          if (provider.isRecording) {
            return FloatingActionButton(
              onPressed: () {
                provider.stopRecordingAndSave();
              },
              backgroundColor: Colors.red,
              child: const Icon(Icons.stop),
            );
          }

          return const RecordingButton();
        },
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }

  void _copyAllTranscriptions(BuildContext context) {
    final provider = Provider.of<LocalTranscriptionProvider>(
      context,
      listen: false,
    );
    if (provider.transcriptions.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No transcriptions to copy')),
      );
      return;
    }

    final text = provider.transcriptions.map((t) => t.text).join('\n\n');

    Clipboard.setData(ClipboardData(text: text));

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('All transcriptions copied to clipboard')),
    );
  }

  void _clearAllTranscriptions(BuildContext context) {
    final provider = Provider.of<LocalTranscriptionProvider>(
      context,
      listen: false,
    );
    if (provider.transcriptions.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No transcriptions to clear')),
      );
      return;
    }

    showDialog(
      context: context,
      builder:
          (context) => AlertDialog(
            title: const Text('Clear all transcriptions?'),
            content: const Text('This action cannot be undone.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () {
                  provider.clearTranscriptions();
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('All transcriptions cleared')),
                  );
                },
                child: const Text('Clear'),
              ),
            ],
          ),
    );
  }
}
