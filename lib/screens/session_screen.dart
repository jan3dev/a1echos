import 'dart:async';
import 'package:echos/utils/utils.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider;
import 'package:ui_components/ui_components.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../widgets/session_app_bar.dart';
import '../widgets/transcription_content_view.dart';
import '../widgets/transcription_list.dart';
import '../widgets/modals/session_input_modal.dart';
import '../providers/local_transcription_provider.dart';
import '../providers/session_provider.dart';
import '../providers/settings_provider.dart';
import '../controllers/session_recording_controller.dart';
import '../controllers/transcription_selection_controller.dart';
import '../controllers/session_navigation_controller.dart';
import '../providers/theme_provider.dart';
import '../logger.dart';
import '../models/app_theme.dart';
import '../models/model_type.dart';
import 'spoken_language_selection_screen.dart';

class SessionScreen extends ConsumerStatefulWidget {
  final String sessionId;

  const SessionScreen({super.key, required this.sessionId});

  @override
  ConsumerState<SessionScreen> createState() => _SessionScreenState();
}

class _SessionScreenState extends ConsumerState<SessionScreen>
    with WidgetsBindingObserver {
  final ScrollController _scrollController = ScrollController();

  late SessionRecordingController _recordingController;
  late TranscriptionSelectionController _selectionController;
  late SessionNavigationController _navigationController;

  bool _isEditing = false;
  bool _isInitializing = true;
  final GlobalKey<TranscriptionListState> _listKey =
      GlobalKey<TranscriptionListState>();
  Timer? _scrollDebounceTimer;

  late LocalTranscriptionProvider _localTranscriptionProvider;
  late SessionProvider _sessionProvider;
  late SettingsProvider _settingsProvider;

  @override
  void initState() {
    super.initState();

    _localTranscriptionProvider = provider
        .Provider.of<LocalTranscriptionProvider>(context, listen: false);
    _sessionProvider = provider.Provider.of<SessionProvider>(
      context,
      listen: false,
    );
    _settingsProvider = provider.Provider.of<SettingsProvider>(
      context,
      listen: false,
    );

    _initializeControllers();

    WidgetsBinding.instance.addObserver(this);
    _initializeSession();
  }

  void _initializeControllers() {
    _recordingController = SessionRecordingController(
      transcriptionProvider: _localTranscriptionProvider,
      sessionProvider: _sessionProvider,
    );

    _selectionController = TranscriptionSelectionController(
      transcriptionProvider: _localTranscriptionProvider,
    );

    _navigationController = SessionNavigationController(
      sessionProvider: _sessionProvider,
      settingsProvider: _settingsProvider,
      transcriptionProvider: _localTranscriptionProvider,
      sessionId: widget.sessionId,
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);

    _scrollDebounceTimer?.cancel();

    try {
      _localTranscriptionProvider.removeListener(_scrollToBottom);
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.ui,
        message: 'Error removing scroll-to-bottom listener',
      );
    }

    _scrollController.dispose();
    _recordingController.dispose();
    _selectionController.dispose();
    _navigationController.dispose();

    if (_recordingController.hasActiveOperation) {
      _recordingController.stopRecordingAndSave();
    }

    super.dispose();
  }

  void _scrollToBottom() {
    // Only scroll during live transcription, not during editing
    final shouldScroll =
        _localTranscriptionProvider.isRecording ||
        (_localTranscriptionProvider.selectedModelType == ModelType.whisper &&
            _localTranscriptionProvider.whisperRealtime &&
            _localTranscriptionProvider.liveVoskTranscriptionPreview != null);

    if (!shouldScroll) return;

    // Cancel previous debounce timer
    _scrollDebounceTimer?.cancel();

    // Debounce rapid calls (wait 50ms for pause in updates)
    _scrollDebounceTimer = Timer(const Duration(milliseconds: 50), () {
      if (_scrollController.hasClients) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_scrollController.hasClients) {
            _scrollController.animateTo(
              _scrollController.position.maxScrollExtent,
              duration: const Duration(milliseconds: 150),
              curve: Curves.easeOut,
            );
          }
        });
      }
    });
  }

  void _initializeSession() {
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final selectedTheme = ref.read(prefsProvider).selectedTheme;
      final colors = selectedTheme.colors(context);
      _recordingController.setContext(context, colors);
      await _navigationController.initializeSession();
      if (!mounted) return;
      setState(() {
        _isInitializing = false;
      });
      _localTranscriptionProvider.addListener(_scrollToBottom);
    });
  }

  void _handleTitlePressed() {
    SessionInputModal.show(
      context,
      ref: ref,
      title: context.loc.sessionRenameTitle,
      buttonText: context.loc.save,
      initialValue: _navigationController.sessionName,
      onSubmit: (name) {
        _navigationController.renameSession(name);
      },
    );
  }

  void _handleCopyAllPressed() {
    _selectionController.copyAllTranscriptions(context, ref);
  }

  void _handleSelectAllPressed() {
    _selectionController.selectAllTranscriptions();
  }

  void _handleDeleteSelectedPressed() {
    _selectionController.deleteSelectedTranscriptions(context, ref);
  }

  void _handleLanguageFlagPressed() {
    Navigator.of(context).push(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            const SpokenLanguageSelectionScreen(),
        transitionDuration: Duration.zero,
        reverseTransitionDuration: Duration.zero,
      ),
    );
  }

  void _handleTranscriptionTap(String id) {
    if (_selectionController.selectionMode) {
      _selectionController.toggleTranscriptionSelection(id);
    }
  }

  void _handleTranscriptionLongPress(String id) {
    _selectionController.handleTranscriptionLongPress(id);
  }

  void _onEditStart() {
    setState(() {
      _isEditing = true;
    });
  }

  void _onEditEnd() {
    setState(() {
      _isEditing = false;
    });
  }

  void _cancelEdit() {
    _listKey.currentState?.cancelEditing();
    FocusScope.of(context).unfocus();
    setState(() {
      _isEditing = false;
    });
  }

  void _saveEdit() {
    _listKey.currentState?.saveCurrentEdit();
  }

  void _handleSharePressed() {
    _selectionController.shareSelectedTranscriptions(context, ref);
  }

  @override
  Widget build(BuildContext context) {
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = selectedTheme.colors(context);

    return ListenableBuilder(
      listenable: Listenable.merge([
        _selectionController,
        _navigationController,
      ]),
      builder: (context, child) {
        return PopScope(
          canPop: !_isEditing,
          onPopInvokedWithResult: (didPop, result) {
            if (_isEditing) _cancelEdit();
          },
          child: Scaffold(
            backgroundColor: colors.surfaceBackground,
            appBar: SessionAppBar(
              sessionName: _navigationController.sessionName,
              selectionMode: _selectionController.selectionMode,
              editMode: _isEditing,
              isIncognitoSession: _navigationController.isIncognitoSession,
              onBackPressed: _isEditing
                  ? _cancelEdit
                  : () => _navigationController.handleBackNavigation(context),
              onTitlePressed: _handleTitlePressed,
              onCopyAllPressed: _handleCopyAllPressed,
              onLanguageFlagPressed: _handleLanguageFlagPressed,
              onSelectAllPressed: _handleSelectAllPressed,
              onDeleteSelectedPressed: _handleDeleteSelectedPressed,
              onCancelEditPressed: _cancelEdit,
              onSaveEditPressed: _saveEdit,
            ),
            body: GestureDetector(
              behavior: HitTestBehavior.translucent,
              onTap: () {
                if (!_isEditing) FocusScope.of(context).unfocus();
              },
              child: Stack(
                children: [
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: _isInitializing
                        ? const SizedBox.shrink()
                        : TranscriptionContentView(
                            listKey: _listKey,
                            scrollController: _scrollController,
                            selectionMode: _selectionController.selectionMode,
                            selectedTranscriptionIds:
                                _selectionController.selectedTranscriptionIds,
                            onTranscriptionTap: _handleTranscriptionTap,
                            onTranscriptionLongPress:
                                _handleTranscriptionLongPress,
                            onEditStart: _onEditStart,
                            onEditEnd: _onEditEnd,
                          ),
                  ),
                  if (_selectionController.selectionMode)
                    Positioned(
                      bottom: 32,
                      left: 16,
                      right: 16,
                      child: Center(
                        child: AquaButton.primary(
                          text: context.loc.share,
                          onPressed: _selectionController.hasSelectedItems
                              ? _handleSharePressed
                              : null,
                        ),
                      ),
                    )
                  else if (!_isInitializing)
                    provider.Consumer<LocalTranscriptionProvider>(
                      builder: (context, transcriptionProvider, _) {
                        final recordingControlsState =
                            StateMappingUtils.mapTranscriptionStateToRecordingControlsState(
                              transcriptionProvider.state,
                            );

                        return AquaRecordingControlsView(
                          colors: colors,
                          state: recordingControlsState,
                          audioLevel: transcriptionProvider.audioLevel,
                          onRecordingStart: () =>
                              _recordingController.startRecording(),
                          onRecordingStop: () =>
                              transcriptionProvider.stopRecordingAndSave(),
                        );
                      },
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
