import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../providers/local_transcription_provider.dart';
import '../providers/session_provider.dart';
import '../models/model_type.dart';
import '../widgets/recording_button.dart';
import 'settings_screen.dart';
import 'dart:developer' as developer;
import '../widgets/session_drawer.dart';
import '../widgets/live_transcription_view.dart';
import '../widgets/processing_view.dart';
import '../widgets/error_view.dart';
import '../widgets/transcription_content_view.dart';
import '../constants/app_constants.dart';

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
      drawer: const SessionDrawer(),
      appBar: AppBar(
        title: const Text('Transcription App'),
        actions: [
          IconButton(
            icon: const Icon(Icons.copy_all),
            onPressed: () {
              _copyAllTranscriptions(context);
            },
            tooltip: AppStrings.copyAllTooltip,
          ),
          IconButton(
            icon: const Icon(Icons.delete_sweep),
            onPressed: () {
              _clearAllTranscriptions(context);
            },
            tooltip: AppStrings.clearAllTooltip,
          ),
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const SettingsScreen()),
              );
            },
            tooltip: AppStrings.settingsTooltip,
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(24),
          child: Container(
            alignment: Alignment.centerLeft,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Row(
              children: [
                Icon(
                  Icons.lock,
                  size: 16,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
                const SizedBox(width: 4),
                Text(
                  AppStrings.encryptedAtRest,
                  style: TextStyle(
                    fontSize: 12,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      body: Consumer<LocalTranscriptionProvider>(
        builder: (context, provider, child) {
          // Drive UI off the consolidated state
          switch (provider.state) {
            case TranscriptionState.loading:
              return ProcessingView(message: AppStrings.loading);
            case TranscriptionState.recording:
              if (provider.selectedModelType == ModelType.vosk) {
                return LiveTranscriptionView(controller: _scrollController);
              }
              break;
            case TranscriptionState.transcribing:
              final message =
                  provider.selectedModelType == ModelType.whisper
                      ? AppStrings.processingWhisper
                      : AppStrings.processingTranscription;
              return ProcessingView(message: message);
            case TranscriptionState.error:
              return ErrorView(
                errorMessage: provider.error!,
                onRetry: () => provider.changeModel(provider.selectedModelType),
              );
            case TranscriptionState.ready:
              break;
          }
          // default: show empty state or transcription list
          return TranscriptionContentView(controller: _scrollController);
        },
      ),
      floatingActionButton: Consumer<LocalTranscriptionProvider>(
        builder: (context, provider, _) {
          if (provider.state == TranscriptionState.recording) {
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
    if (provider.sessionTranscriptions.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text(AppStrings.noTranscriptionsToCopy)),
      );
      return;
    }

    final text = provider.sessionTranscriptions.map((t) => t.text).join('\n\n');

    Clipboard.setData(ClipboardData(text: text));

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text(AppStrings.allTranscriptionsCopied)),
    );
  }

  void _clearAllTranscriptions(BuildContext context) {
    final locProv = Provider.of<LocalTranscriptionProvider>(
      context,
      listen: false,
    );
    final sessProv = Provider.of<SessionProvider>(context, listen: false);
    if (locProv.sessionTranscriptions.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text(AppStrings.noTranscriptionsToClear)),
      );
      return;
    }

    showDialog(
      context: context,
      builder:
          (context) => AlertDialog(
            title: const Text(AppStrings.clearAllDialogTitle),
            content: const Text(AppStrings.clearAllDialogContent),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text(AppStrings.cancel),
              ),
              TextButton(
                onPressed: () {
                  locProv.clearTranscriptionsForSession(
                    sessProv.activeSessionId,
                  );
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(AppStrings.allTranscriptionsClearedSession),
                    ),
                  );
                },
                child: const Text(AppStrings.clear),
              ),
            ],
          ),
    );
  }
}
