import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../providers/local_transcription_provider.dart';
import '../services/model_service.dart';
import '../widgets/recording_button.dart';
import '../widgets/transcription_item.dart';
import 'settings_screen.dart';
import 'dart:developer' as developer;

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = Provider.of<LocalTranscriptionProvider>(
        context,
        listen: false,
      );
      provider.addListener(_scrollToBottom);
    });
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollController.hasClients) {
          _scrollController.animateTo(
            _scrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        }
      });
    }
  }

  // Remove listener in dispose
  @override
  void dispose() {
    // Remove listener using the context BEFORE super.dispose()
    // Check if the provider is still accessible (might not be needed if disposed elsewhere)
    try {
      Provider.of<LocalTranscriptionProvider>(
        context,
        listen: false,
      ).removeListener(_scrollToBottom);
    } catch (e) {
      developer.log('Error removing listener: $e', name: '_HomeScreenState');
    }
    _scrollController.dispose();
    super.dispose();
  }

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
          if (provider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.selectedModelType == ModelType.vosk &&
              provider.isStreaming &&
              provider.isRecording) {
            return Column(
              children: [
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

                Expanded(child: _buildTranscriptionList(provider)),
              ],
            );
          }

          if (provider.isTranscribing) {
            final message =
                provider.selectedModelType == ModelType.whisper
                    ? 'Processing Whisper transcription (this may take a moment)...'
                    : 'Processing transcription...';
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const CircularProgressIndicator(),
                  const SizedBox(height: 16),
                  Text(
                    message,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 16),
                  ),
                ],
              ),
            );
          }

          // Show error state
          if (provider.error != null) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.error_outline,
                      size: 48,
                      color: Colors.red.shade700,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Error: ${provider.error!}',
                      style: TextStyle(
                        color: Colors.red.shade900,
                        fontSize: 16,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: () {
                        // Attempt to re-initialize the model on error
                        Provider.of<LocalTranscriptionProvider>(
                          context,
                          listen: false,
                        ).changeModel(provider.selectedModelType);
                      },
                      child: const Text('Retry Initialization'),
                    ),
                  ],
                ),
              ),
            );
          }

          // Show initial state or list of transcriptions
          if (provider.transcriptions.isEmpty && !provider.isRecording) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24.0),
                child: Text(
                  'Tap the record button below to start transcribing with the selected model.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 16, color: Colors.grey),
                ),
              ),
            );
          }

          // Default view: List of existing transcriptions
          return _buildTranscriptionList(provider);
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

  Widget _buildTranscriptionList(LocalTranscriptionProvider provider) {
    if (provider.transcriptions.isEmpty) {
      // Return an empty container or a subtle message if needed when
      // live streaming is active but no past transcriptions exist.
      return const SizedBox.shrink();
    }
    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.only(bottom: 80),
      itemCount: provider.transcriptions.length,
      itemBuilder: (context, index) {
        final transcription = provider.transcriptions[index];
        return TranscriptionItem(transcription: transcription);
      },
    );
  }
}
