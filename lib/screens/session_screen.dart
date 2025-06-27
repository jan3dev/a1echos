import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ui_components/ui_components.dart';

import '../widgets/session_app_bar.dart';
import '../widgets/transcription_content_view.dart';
import '../widgets/recording_controls_view.dart';
import '../constants/app_constants.dart';
import '../widgets/modals/session_input_modal.dart';
import '../providers/local_transcription_provider.dart';
import '../providers/session_provider.dart';
import '../providers/settings_provider.dart';
import '../controllers/session_recording_controller.dart';
import '../controllers/transcription_selection_controller.dart';
import '../controllers/session_navigation_controller.dart';

class SessionScreen extends StatefulWidget {
  final String sessionId;

  const SessionScreen({super.key, required this.sessionId});

  @override
  State<SessionScreen> createState() => _SessionScreenState();
}

class _SessionScreenState extends State<SessionScreen>
    with WidgetsBindingObserver {
  final ScrollController _scrollController = ScrollController();

  late SessionRecordingController _recordingController;
  late TranscriptionSelectionController _selectionController;
  late SessionNavigationController _navigationController;

  late LocalTranscriptionProvider _localTranscriptionProvider;
  late SessionProvider _sessionProvider;
  late SettingsProvider _settingsProvider;

  @override
  void initState() {
    super.initState();

    _localTranscriptionProvider = Provider.of<LocalTranscriptionProvider>(
      context,
      listen: false,
    );
    _sessionProvider = Provider.of<SessionProvider>(context, listen: false);
    _settingsProvider = Provider.of<SettingsProvider>(context, listen: false);

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
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    _navigationController.handleAppLifecycleChange(state);
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
      _localTranscriptionProvider.removeListener(_scrollToBottom);
    } catch (e) {
      debugPrint('Error removing listener: $e');
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

  void _initializeSession() {
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await _navigationController.initializeSession();
      _localTranscriptionProvider.addListener(_scrollToBottom);
    });
  }

  void _handleTitlePressed() {
    SessionInputModal.show(
      context,
      title: AppStrings.sessionRenameTitle,
      buttonText: AppStrings.save,
      initialValue: _navigationController.sessionName,
      onSubmit: (name) {
        _navigationController.renameSession(name);
      },
    );
  }

  void _handleEditPressed() {
    SessionInputModal.show(
      context,
      title: AppStrings.sessionRenameTitle,
      buttonText: AppStrings.save,
      initialValue: _navigationController.sessionName,
      onSubmit: (name) {
        _navigationController.renameSession(name);
      },
    );
  }

  void _handleCopyAllPressed() {
    _selectionController.copyAllTranscriptions(context);
  }

  void _handleSelectAllPressed() {
    _selectionController.selectAllTranscriptions();
  }

  void _handleDeleteSelectedPressed() {
    _selectionController.deleteSelectedTranscriptions(context);
  }

  void _handleTranscriptionTap(String id) {
    if (_selectionController.selectionMode) {
      _selectionController.toggleTranscriptionSelection(id);
    }
  }

  void _handleTranscriptionLongPress(String id) {
    _selectionController.handleTranscriptionLongPress(id);
  }

  void _handleSharePressed() {
    _selectionController.shareSelectedTranscriptions(context);
  }

  @override
  Widget build(BuildContext context) {
    final colors = AquaColors.lightColors;

    return ListenableBuilder(
      listenable: Listenable.merge([
        _selectionController,
        _navigationController,
      ]),
      builder: (context, child) {
        return Scaffold(
          backgroundColor: colors.surfaceBackground,
          appBar: SessionAppBar(
            sessionName: _navigationController.sessionName,
            selectionMode: _selectionController.selectionMode,
            isIncognitoSession: _navigationController.isIncognitoSession,
            onBackPressed: () =>
                _navigationController.handleBackNavigation(context),
            onTitlePressed: _handleTitlePressed,
            onEditPressed: _handleEditPressed,
            onCopyAllPressed: _handleCopyAllPressed,
            onSelectAllPressed: _handleSelectAllPressed,
            onDeleteSelectedPressed: _handleDeleteSelectedPressed,
          ),
          body: Stack(
            children: [
              TranscriptionContentView(
                scrollController: _scrollController,
                selectionMode: _selectionController.selectionMode,
                selectedTranscriptionIds:
                    _selectionController.selectedTranscriptionIds,
                onTranscriptionTap: _handleTranscriptionTap,
                onTranscriptionLongPress: _handleTranscriptionLongPress,
              ),
              if (_selectionController.selectionMode)
                Positioned(
                  bottom: 32,
                  left: 16,
                  right: 16,
                  child: Center(
                    child: AquaButton.primary(
                      text: AppStrings.share,
                      onPressed: _selectionController.hasSelectedItems
                          ? _handleSharePressed
                          : null,
                    ),
                  ),
                )
              else
                const RecordingControlsView(),
            ],
          ),
        );
      },
    );
  }
}
