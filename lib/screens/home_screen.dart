import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:ui_components/ui_components.dart';
import 'package:intl/intl.dart';
import '../providers/local_transcription_provider.dart';
import '../providers/session_provider.dart';
import '../models/session.dart';
import '../widgets/recording_button.dart';
import 'settings_screen.dart';
import 'dart:developer' as developer;
import '../widgets/session_list.dart';
import 'session_screen.dart';
import '../widgets/modals/session_input_modal.dart';
import '../widgets/modals/confirmation_modal.dart';
import '../widgets/empty_transcriptions_state.dart';
import '../constants/app_constants.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  final ScrollController _scrollController = ScrollController();
  bool _selectionMode = false;
  Set<String> _selectedSessionIds = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = Provider.of<LocalTranscriptionProvider>(
        context,
        listen: false,
      );
      provider.addListener(_scrollToBottom);
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _checkForExpiredTemporarySession();
    }
  }

  void _checkForExpiredTemporarySession() {
    final sessionProvider = Provider.of<SessionProvider>(
      context,
      listen: false,
    );

    if (sessionProvider.isActiveTemporarySessionExpired()) {
      sessionProvider.validateSessionsOnAppStart();
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
      developer.log('Error removing listener: $e', name: '_HomeScreenState');
    }
    _scrollController.dispose();
    super.dispose();
  }

  void _toggleSessionSelection(String sessionId) {
    setState(() {
      if (_selectedSessionIds.contains(sessionId)) {
        _selectedSessionIds.remove(sessionId);
      } else {
        _selectedSessionIds.add(sessionId);
      }

      if (_selectedSessionIds.isEmpty) {
        _selectionMode = false;
      }
    });
  }

  void _selectAllSessions() {
    final sessionProvider = Provider.of<SessionProvider>(
      context,
      listen: false,
    );
    setState(() {
      _selectedSessionIds =
          sessionProvider.sessions.map((session) => session.id).toSet();
    });
  }

  void _deleteSelectedSessions() {
    final sessionProvider = Provider.of<SessionProvider>(
      context,
      listen: false,
    );

    if (_selectedSessionIds.isEmpty) return;

    ConfirmationModal.show(
      context: context,
      title: AppStrings.homeDeleteSelectedSessionsTitle,
      message: AppStrings.homeDeleteSelectedSessionsMessage
          .replaceAll('{count}', _selectedSessionIds.length.toString())
          .replaceAll(
            '{sessions}',
            _selectedSessionIds.length == 1 ? 'session' : 'sessions',
          ),
      confirmText: AppStrings.homeDeleteSessionsButton,
      onConfirm: () {
        Navigator.pop(context);
        for (var sessionId in _selectedSessionIds) {
          sessionProvider.deleteSession(sessionId);
        }
        setState(() {
          _selectionMode = false;
          _selectedSessionIds.clear();
        });
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(AppStrings.homeSessionsDeleted)));
      },
    );
  }

  void _handleSessionLongPress(Session session) {
    if (!_selectionMode) {
      setState(() {
        _selectionMode = true;
        _selectedSessionIds.add(session.id);
      });
    }
  }

  void _openSession(String sessionId) {
    if (_selectionMode) return;

    final sessionProvider = Provider.of<SessionProvider>(
      context,
      listen: false,
    );

    if (sessionId == sessionProvider.activeSessionId &&
        sessionProvider.isActiveTemporarySessionExpired()) {
      sessionProvider.validateSessionsOnAppStart();
      return;
    }

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => SessionScreen(sessionId: sessionId),
      ),
    ).then((_) {
      _checkForTemporarySession();
    });
  }

  void _startRecording() async {
    final sessionProvider = Provider.of<SessionProvider>(
      context,
      listen: false,
    );

    final now = DateTime.now();
    final formattedDate = DateFormat('MMM d, h:mm a').format(now);
    final sessionName = '${AppStrings.recordingPrefix} $formattedDate';

    try {
      String sessionId;
      if (sessionProvider.isActiveSessionTemporary() &&
          !sessionProvider.isActiveTemporarySessionExpired()) {
        sessionId = sessionProvider.activeSessionId;
        await sessionProvider.updateSessionModifiedTimestamp(sessionId);
      } else {
        sessionId = await sessionProvider.createSession(
          sessionName,
          isTemporary: true,
        );
      }

      if (!mounted) return;

      final provider = Provider.of<LocalTranscriptionProvider>(
        context,
        listen: false,
      );

      provider.startRecording();

      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => SessionScreen(sessionId: sessionId),
        ),
      ).then((_) {
        _checkForTemporarySession();
      });
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            AppStrings.homeErrorCreatingSession.replaceAll(
              '{error}',
              e.toString(),
            ),
          ),
        ),
      );
    }
  }

  void _checkForTemporarySession() async {
    final sessionProvider = Provider.of<SessionProvider>(
      context,
      listen: false,
    );

    final locProvider = Provider.of<LocalTranscriptionProvider>(
      context,
      listen: false,
    );

    if (sessionProvider.isActiveSessionTemporary() &&
        !sessionProvider.isActiveTemporarySessionExpired() &&
        locProvider.sessionTranscriptions.isNotEmpty) {
      _showSaveTemporarySessionDialog(
        sessionProvider.activeSessionId,
        sessionProvider.activeSession.name,
      );
    }
  }

  void _showSaveTemporarySessionDialog(String sessionId, String initialName) {
    final sessionProvider = Provider.of<SessionProvider>(
      context,
      listen: false,
    );

    SessionInputModal.show(
      context,
      title: AppStrings.homeSaveRecordingTitle,
      buttonText: AppStrings.save,
      initialValue: initialName,
      showCancelButton: true,
      cancelButtonText: AppStrings.cancel,
      onSubmit: (newName) {
        if (newName.isNotEmpty) {
          sessionProvider.saveTemporarySession(sessionId, newName);
        } else {
          sessionProvider.makeSessionPermanent(sessionId);
        }
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(AppStrings.homeSessionSaved)));
      },
      onCancel: () {
        sessionProvider.deleteSession(sessionId);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppStrings.homeRecordingDiscarded)),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AquaColors.lightColors;

    final sessionProvider = Provider.of<SessionProvider>(context);
    final bool isEmpty =
        sessionProvider.sessions.isEmpty ||
        (sessionProvider.sessions.length == 1 &&
            sessionProvider.sessions.first.isTemporary);

    return Scaffold(
      backgroundColor: colors.surfaceBackground,
      appBar: AppBar(
        backgroundColor: colors.surfaceBackground,
        elevation: 0,
        leadingWidth: isEmpty || _selectionMode ? 56 : 0,
        automaticallyImplyLeading: false,
        titleSpacing: isEmpty || _selectionMode ? 0 : 16,
        leading:
            isEmpty || _selectionMode
                ? IconButton(
                  icon: AquaIcon.settings(),
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => const SettingsScreen(),
                      ),
                    );
                  },
                  tooltip: AppStrings.settingsTooltip,
                  color: colors.textPrimary,
                )
                : null,
        title:
            !isEmpty && !_selectionMode
                ? SvgPicture.asset('assets/icons/echo-logo.svg')
                : null,
        actions: [
          if (_selectionMode) ...[
            IconButton(
              icon: SvgPicture.asset('assets/icons/select-all.svg'),
              onPressed: _selectAllSessions,
              tooltip: AppStrings.selectAll,
              color: colors.textPrimary,
            ),
            IconButton(
              icon: AquaIcon.trash(),
              onPressed: _deleteSelectedSessions,
              tooltip: AppStrings.deleteSelected,
              color: colors.textPrimary,
            ),
          ] else ...[
            if (!isEmpty)
              IconButton(
                icon: AquaIcon.settings(),
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const SettingsScreen(),
                    ),
                  );
                },
                tooltip: AppStrings.settingsTooltip,
                color: colors.textPrimary,
              ),
          ],
          const SizedBox(width: 8),
        ],
      ),
      body: Stack(
        children: [
          isEmpty ? const EmptyTranscriptionsState() : _buildSessionList(),
          Positioned(
            bottom: 32,
            left: 0,
            right: 0,
            child: Center(
              child: RecordingButton(onRecordingStart: _startRecording),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSessionList() {
    return Column(
      children: [
        Padding(padding: const EdgeInsets.all(16.0)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: SessionList(
            selectionMode: _selectionMode,
            selectedSessionIds: _selectedSessionIds,
            onSessionLongPress: _handleSessionLongPress,
            onSessionTap: _openSession,
            onSelectionToggle: _toggleSessionSelection,
          ),
        ),
      ],
    );
  }
}
