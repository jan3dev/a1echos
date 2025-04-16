import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../providers/transcription_provider.dart';
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
      body: Consumer<TranscriptionProvider>(
        builder: (context, provider, child) {
          if (provider.isTranscribing) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Transcribing audio...'),
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
                  Text(provider.error!, style: const TextStyle(color: Colors.red)),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () {
                      Provider.of<TranscriptionProvider>(context, listen: false)
                          .loadTranscriptions();
                    },
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          if (provider.transcriptions.isEmpty) {
            return const Center(
              child: Text('No transcriptions yet. Tap the record button to start.'),
            );
          }

          return ListView.builder(
            itemCount: provider.transcriptions.length,
            itemBuilder: (context, index) {
              final transcription = provider.transcriptions[index];
              return TranscriptionItem(
                transcription: transcription,
              );
            },
          );
        },
      ),
      floatingActionButton: const RecordingButton(),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }

  void _copyAllTranscriptions(BuildContext context) {
    final provider = Provider.of<TranscriptionProvider>(context, listen: false);
    if (provider.transcriptions.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No transcriptions to copy')),
      );
      return;
    }

    final text = provider.transcriptions
        .map((t) => t.text)
        .join('\n\n');
    
    Clipboard.setData(ClipboardData(text: text));
    
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('All transcriptions copied to clipboard')),
    );
  }

  void _clearAllTranscriptions(BuildContext context) {
    final provider = Provider.of<TranscriptionProvider>(context, listen: false);
    if (provider.transcriptions.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No transcriptions to clear')),
      );
      return;
    }

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
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