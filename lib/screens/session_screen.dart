import 'package:dolphinecho/widgets/modals/session_input_modal.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/svg.dart';
import 'package:provider/provider.dart';
import 'package:ui_components/ui_components.dart';
import '../providers/local_transcription_provider.dart';
import '../providers/session_provider.dart';
import '../models/session.dart';
import '../widgets/recording_button.dart';
import '../widgets/audio_wave_visualization.dart';
import '../widgets/live_transcription_view.dart';
import '../widgets/processing_view.dart';
import '../widgets/error_view.dart';
import '../constants/app_constants.dart';
import '../widgets/modals/confirmation_modal.dart';
import '../widgets/transcription_list.dart';
import '../widgets/empty_transcriptions_state.dart';

class SessionScreen extends StatefulWidget {
  final String sessionId;

  const SessionScreen({super.key, required this.sessionId});

  @override
  State<SessionScreen> createState() => _SessionScreenState();
}

class _SessionScreenState extends State<SessionScreen>
    with WidgetsBindingObserver {
  final ScrollController _scrollController = ScrollController();
  bool _transcriptionSelectionMode = false;
  Set<String> _selectedTranscriptionIds = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initializeSession();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);

    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      final provider = Provider.of<LocalTranscriptionProvider>(
        context,
        listen: false,
      );

      if (provider.isRecording || provider.isTranscribing) {
        provider.stopRecordingAndSave();
      }
    }

    if (state == AppLifecycleState.resumed) {
      _checkForExpiredTemporarySession();
    }
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
    WidgetsBinding.instance.removeObserver(this);

    try {
      Provider.of<LocalTranscriptionProvider>(
        context,
        listen: false,
      ).removeListener(_scrollToBottom);
    } catch (e) {
      debugPrint('Error removing listener: $e');
    }
    _scrollController.dispose();

    final provider = Provider.of<LocalTranscriptionProvider>(
      context,
      listen: false,
    );

    if (provider.isRecording || provider.isTranscribing) {
      provider.stopRecordingAndSave();
    }

    super.dispose();
  }

  void _toggleTranscriptionSelection(String transcriptionId) {
    setState(() {
      if (_selectedTranscriptionIds.contains(transcriptionId)) {
        _selectedTranscriptionIds.remove(transcriptionId);
        if (_selectedTranscriptionIds.isEmpty) {
          _transcriptionSelectionMode = false;
        }
      } else {
        _selectedTranscriptionIds.add(transcriptionId);
      }
    });
  }

  void _handleTranscriptionLongPress(String transcriptionId) {
    if (!_transcriptionSelectionMode) {
      setState(() {
        _transcriptionSelectionMode = true;
        _selectedTranscriptionIds.add(transcriptionId);
      });
    } else {
      _toggleTranscriptionSelection(transcriptionId);
    }
  }

  void _selectAllTranscriptions() {
    final provider = Provider.of<LocalTranscriptionProvider>(
      context,
      listen: false,
    );

    setState(() {
      _selectedTranscriptionIds =
          provider.sessionTranscriptions
              .map((transcription) => transcription.id)
              .toSet();
    });
  }

  void _deleteSelectedTranscriptions() {
    if (_selectedTranscriptionIds.isEmpty) return;

    final provider = Provider.of<LocalTranscriptionProvider>(
      context,
      listen: false,
    );

    ConfirmationModal.show(
      context: context,
      title: AppStrings.sessionDeleteTranscriptionsTitle,
      message: AppStrings.sessionDeleteTranscriptionsMessage
          .replaceAll('{count}', _selectedTranscriptionIds.length.toString())
          .replaceAll(
            '{transcriptions}',
            _selectedTranscriptionIds.length == 1
                ? 'transcription'
                : 'transcriptions',
          ),
      confirmText: AppStrings.sessionDeleteTranscriptionsButton,
      cancelText: AppStrings.cancel,
      onConfirm: () async {
        Navigator.pop(context);

        try {
          await provider.deleteTranscriptions(_selectedTranscriptionIds);
          if (mounted) {
            setState(() {
              _transcriptionSelectionMode = false;
              _selectedTranscriptionIds.clear();
            });
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(AppStrings.sessionTranscriptionsDeleted)),
            );
          }
        } catch (e) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  AppStrings.sessionErrorDeletingTranscriptions.replaceAll(
                    '{error}',
                    e.toString(),
                  ),
                ),
              ),
            );
          }
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

  List<Widget> _buildNormalActions() {
    return [
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
    ];
  }

  List<Widget> _buildSelectionActions() {
    return [
      IconButton(
        icon: SvgPicture.asset('assets/icons/select-all.svg'),
        onPressed: _selectAllTranscriptions,
        tooltip: AppStrings.selectAll,
      ),
      IconButton(
        icon: AquaIcon.trash(),
        onPressed: _deleteSelectedTranscriptions,
        tooltip: AppStrings.deleteSelected,
      ),
    ];
  }

  void _checkForExpiredTemporarySession() {
    final sessionProvider = Provider.of<SessionProvider>(
      context,
      listen: false,
    );

    if (widget.sessionId == sessionProvider.activeSessionId &&
        sessionProvider.isActiveTemporarySessionExpired()) {
      Navigator.of(context).pop();
    }
  }

  void _initializeSession() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final sessionProvider = Provider.of<SessionProvider>(
        context,
        listen: false,
      );
      final provider = Provider.of<LocalTranscriptionProvider>(
        context,
        listen: false,
      );

      if (sessionProvider.isActiveTemporarySessionExpired()) {
        Navigator.of(context).pop();
        return;
      }

      sessionProvider.switchSession(widget.sessionId);

      sessionProvider.updateSessionModifiedTimestamp(widget.sessionId);

      provider.loadTranscriptionsForSession(widget.sessionId);
      provider.addListener(_scrollToBottom);
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = AquaColors.lightColors;
    final sessionProvider = context.watch<SessionProvider>();
    final provider = Provider.of<LocalTranscriptionProvider>(
      context,
      listen: false,
    );

    final sessionName =
        sessionProvider.sessions
            .firstWhere(
              (s) => s.id == widget.sessionId,
              orElse:
                  () => Session(
                    id: widget.sessionId,
                    name: 'Session',
                    timestamp: DateTime.now(),
                  ),
            )
            .name;

    return Scaffold(
      backgroundColor: colors.surfaceBackground,
      appBar: AquaTopAppBar(
        colors: colors,
        onBackPressed: () {
          if (provider.isRecording || provider.isTranscribing) {
            provider.stopRecordingAndSave();
          }
          Navigator.of(context).pop();
        },
        title: sessionName,
        actions:
            _transcriptionSelectionMode
                ? _buildSelectionActions()
                : _buildNormalActions(),
        onTitlePressed: () {
          SessionInputModal.show(
            context,
            title: AppStrings.sessionRenameTitle,
            buttonText: AppStrings.save,
            initialValue: sessionName,
            onSubmit: (name) {
              sessionProvider.renameSession(widget.sessionId, name);
            },
          );
        },
      ),
      body: Stack(
        children: [
          Positioned.fill(
            bottom: 120,
            child: Consumer<LocalTranscriptionProvider>(
              builder: (context, provider, child) {
                if (provider.isLoading) {
                  return const Center(child: CircularProgressIndicator());
                }

                if (provider.error != null) {
                  return ErrorView(errorMessage: provider.error!);
                }

                if (provider.isRecording) {
                  return Column(
                    children: [
                      Expanded(
                        child: LiveTranscriptionView(
                          controller: _scrollController,
                        ),
                      ),
                    ],
                  );
                }

                if (provider.isTranscribing) {
                  return ProcessingView(
                    message: AppStrings.processingTranscription,
                  );
                }

                if (provider.sessionTranscriptions.isEmpty) {
                  return EmptyTranscriptionsState(
                    title: AppStrings.sessionEmptyStateTitle,
                    message: AppStrings.sessionEmptyStateMessage,
                  );
                }

                return TranscriptionList(
                  controller: _scrollController,
                  selectionMode: _transcriptionSelectionMode,
                  selectedTranscriptionIds: _selectedTranscriptionIds,
                  onTranscriptionTap: (id) {
                    if (_transcriptionSelectionMode) {
                      _toggleTranscriptionSelection(id);
                    }
                  },
                  onTranscriptionLongPress: _handleTranscriptionLongPress,
                );
              },
            ),
          ),
          Positioned(
            bottom: 32,
            left: 0,
            right: 0,
            child: Center(
              child: Consumer<LocalTranscriptionProvider>(
                builder: (context, transcriptionProvider, _) {
                  if (transcriptionProvider.isRecording) {
                    return Stack(
                      alignment: Alignment.center,
                      children: [
                        AudioWaveVisualization(
                          state: transcriptionProvider.state,
                          modelType: transcriptionProvider.selectedModelType,
                        ),
                        RecordingButton(useProviderState: true),
                      ],
                    );
                  } else {
                    return RecordingButton(useProviderState: true);
                  }
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
