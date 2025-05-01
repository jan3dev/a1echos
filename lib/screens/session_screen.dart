import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:ui_components/ui_components.dart';
import '../providers/local_transcription_provider.dart';
import '../providers/session_provider.dart';
import '../models/model_type.dart';
import '../models/session.dart';
import '../widgets/recording_button.dart';
import '../widgets/audio_wave_visualization.dart';
import '../widgets/live_transcription_view.dart';
import '../widgets/processing_view.dart';
import '../widgets/error_view.dart';
import '../widgets/transcription_content_view.dart';
import '../constants/app_constants.dart';
import '../widgets/modals/confirmation_modal.dart';
import '../widgets/modals/session_input_modal.dart';

class SessionScreen extends StatefulWidget {
  final String sessionId;

  const SessionScreen({super.key, required this.sessionId});

  @override
  State<SessionScreen> createState() => _SessionScreenState();
}

class _SessionScreenState extends State<SessionScreen> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final sessionProvider = Provider.of<SessionProvider>(
        context,
        listen: false,
      );
      final provider = Provider.of<LocalTranscriptionProvider>(
        context,
        listen: false,
      );

      if (sessionProvider.activeSessionId != widget.sessionId) {
        sessionProvider.switchSession(widget.sessionId);
      }

      provider.loadTranscriptionsForSession(widget.sessionId);
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

  @override
  void dispose() {
    try {
      Provider.of<LocalTranscriptionProvider>(
        context,
        listen: false,
      ).removeListener(_scrollToBottom);
    } catch (e) {
      debugPrint('Error removing listener: $e');
    }
    _scrollController.dispose();
    super.dispose();
  }

  void _showRenameSessionDialog() {
    final sessionProvider = Provider.of<SessionProvider>(
      context,
      listen: false,
    );

    final session = sessionProvider.sessions.firstWhere(
      (s) => s.id == widget.sessionId,
      orElse:
          () => Session(
            id: widget.sessionId,
            name: 'Session',
            timestamp: DateTime.now(),
          ),
    );

    SessionInputModal.show(
      context,
      title: 'Rename Session',
      buttonText: 'Rename',
      initialValue: session.name,
      onSubmit: (newName) {
        if (newName.isNotEmpty) {
          sessionProvider.renameSession(session.id, newName);
        }
      },
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

    if (locProv.sessionTranscriptions.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text(AppStrings.noTranscriptionsToClear)),
      );
      return;
    }

    ConfirmationModal.show(
      context: context,
      title: AppStrings.clearAllDialogTitle,
      message: AppStrings.clearAllDialogContent,
      confirmText: AppStrings.clear,
      cancelText: AppStrings.cancel,
      onConfirm: () {
        locProv.clearTranscriptionsForSession(widget.sessionId);
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(AppStrings.allTranscriptionsClearedSession),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AquaColors.lightColors.surfaceBackground,
      appBar: AquaTopAppBar(
        colors: AquaColors.lightColors,
        title:
            context
                .watch<SessionProvider>()
                .sessions
                .firstWhere(
                  (s) => s.id == widget.sessionId,
                  orElse:
                      () => Session(
                        id: widget.sessionId,
                        name: 'Session',
                        timestamp: DateTime.now(),
                      ),
                )
                .name,
        onTitlePressed: _showRenameSessionDialog,
        actions: [
          IconButton(
            icon: AquaIcon.copy(),
            onPressed: () => _copyAllTranscriptions(context),
            tooltip: AppStrings.copyAllTooltip,
          ),
          IconButton(
            icon: AquaIcon.trash(),
            onPressed: () => _clearAllTranscriptions(context),
            tooltip: AppStrings.clearAllTooltip,
          ),
        ],
      ),
      body: Stack(
        children: [
          Positioned.fill(
            bottom: 120,
            child: Consumer<LocalTranscriptionProvider>(
              builder: (context, provider, child) {
                switch (provider.state) {
                  case TranscriptionState.loading:
                    return ProcessingView(message: AppStrings.loading);
                  case TranscriptionState.recording:
                    if (provider.selectedModelType == ModelType.vosk) {
                      return LiveTranscriptionView(
                        controller: _scrollController,
                      );
                    }
                    break;
                  case TranscriptionState.transcribing:
                    if (provider.selectedModelType != ModelType.whisper) {
                      return ProcessingView(
                        message: AppStrings.processingTranscription,
                      );
                    }
                    return const SizedBox();
                  case TranscriptionState.error:
                    return ErrorView(
                      errorMessage: provider.error!,
                      onRetry:
                          () =>
                              provider.changeModel(provider.selectedModelType),
                    );
                  case TranscriptionState.ready:
                    break;
                }
                return TranscriptionContentView(controller: _scrollController);
              },
            ),
          ),

          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Consumer<LocalTranscriptionProvider>(
              builder: (context, provider, _) {
                final bool showAudioWave =
                    provider.selectedModelType == ModelType.whisper &&
                    (provider.state == TranscriptionState.recording ||
                        provider.state == TranscriptionState.transcribing);

                final bool isTranscribing =
                    provider.state == TranscriptionState.transcribing;

                return Container(
                  padding: const EdgeInsets.only(bottom: 20),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (isTranscribing &&
                          provider.selectedModelType == ModelType.whisper)
                        Padding(
                          padding: const EdgeInsets.only(top: 12, bottom: 4),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              SizedBox(
                                width: 16,
                                height: 16,
                                child: AquaIndefinateProgressIndicator(
                                  color: AquaColors.lightColors.textPrimary,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                AppStrings.transcribingStatus,
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),

                      if (showAudioWave)
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 8,
                          ),
                          child: AudioWaveVisualization(
                            state: provider.state,
                            modelType: provider.selectedModelType,
                          ),
                        ),

                      SizedBox(
                        height: 80,
                        child: Center(
                          child: RecordingButton(
                            isRecording:
                                provider.state == TranscriptionState.recording,
                            useProviderState: false,
                            onRecordingStart: () => provider.startRecording(),
                            onRecordingStop:
                                () => provider.stopRecordingAndSave(),
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
