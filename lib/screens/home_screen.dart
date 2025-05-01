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

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final ScrollController _scrollController = ScrollController();
  bool _selectionMode = false;
  Set<String> _selectedSessionIds = {};

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

  @override
  void dispose() {
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

  // ---- Session Management Methods ----

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
      title: 'Delete Selected Sessions?',
      message:
          'Are you sure you want to delete ${_selectedSessionIds.length} ${_selectedSessionIds.length == 1 ? 'session' : 'sessions'}? This action cannot be undone.',
      confirmText: 'Delete Sessions',
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
        ).showSnackBar(SnackBar(content: Text('Sessions deleted')));
      },
    );
  }

  void _showCreateSessionDialog(BuildContext context) {
    final sessionProvider = Provider.of<SessionProvider>(
      context,
      listen: false,
    );

    SessionInputModal.show(
      context,
      title: 'New Session',
      buttonText: 'Save',
      onSubmit: (name) async {
        try {
          final sessionId = await sessionProvider.createSession(
            name.isEmpty ? 'New Session' : name,
          );

          if (!context.mounted) return;

          _openSession(sessionId);
        } catch (e) {
          if (!context.mounted) return;

          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('Error creating session: $e')));
        }
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
    // Don't navigate when in selection mode
    if (_selectionMode) return;

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
    final sessionName = 'Recording $formattedDate';

    try {
      final sessionId = await sessionProvider.createSession(
        sessionName,
        isTemporary: true,
      );
      if (!mounted) return;

      final provider = Provider.of<LocalTranscriptionProvider>(
        context,
        listen: false,
      );

      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => SessionScreen(sessionId: sessionId),
        ),
      ).then((_) {
        if (mounted) {
          provider.startRecording();

          _checkForTemporarySession();
        }
      });
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Error creating session: $e')));
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
      title: 'Save Recording?',
      buttonText: 'Save',
      initialValue: initialName,
      onSubmit: (newName) {
        if (newName.isNotEmpty) {
          sessionProvider.saveTemporarySession(sessionId, newName);
        } else {
          sessionProvider.makeSessionPermanent(sessionId);
        }
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Session saved')));
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
        leadingWidth: isEmpty ? 56 : 0,
        automaticallyImplyLeading: false,
        titleSpacing: isEmpty ? 0 : 16,
        leading:
            isEmpty
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
                  tooltip: 'Settings',
                  color: colors.textPrimary,
                )
                : null,
        title:
            isEmpty
                ? const SizedBox.shrink()
                : SvgPicture.asset('assets/icon/echo-logo.svg', height: 28),
        actions: [
          if (_selectionMode) ...[
            IconButton(
              icon: AquaIcon.account(),
              onPressed: _selectAllSessions,
              tooltip: 'Select All',
              color: colors.textPrimary,
            ),
            IconButton(
              icon: AquaIcon.trash(),
              onPressed: _deleteSelectedSessions,
              tooltip: 'Delete Selected',
              color: colors.textPrimary,
            ),
          ] else ...[
            IconButton(
              icon: AquaIcon.plus(),
              onPressed: () => _showCreateSessionDialog(context),
              tooltip: 'New Session',
              color: colors.textPrimary,
            ),
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
                tooltip: 'Settings',
                color: colors.textPrimary,
              ),
          ],
          const SizedBox(width: 8),
        ],
      ),
      body: isEmpty ? _buildEmptyState(colors) : _buildSessionList(),
    );
  }

  Widget _buildEmptyState(AquaColors colors) {
    return Stack(
      children: [
        Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 88,
                  height: 88,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: colors.surfaceTertiary,
                    borderRadius: BorderRadius.circular(100),
                  ),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: colors.surfaceSecondary,
                      borderRadius: BorderRadius.circular(100),
                    ),
                    child: AquaIcon.pending(
                      color: colors.textTertiary,
                      size: 32,
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                AquaText.h4Medium(
                  text: 'No Transcriptions Yet',
                  size: 24,
                  color: colors.textPrimary,
                ),
                const SizedBox(height: 6),
                Text(
                  'Hit the record button to start capturing and transcribing your voice notes.',
                  maxLines: 5,
                  textAlign: TextAlign.center,
                  style: AquaTypography.body1.copyWith(
                    height: 1.2,
                    color: colors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ),

        Positioned(
          left: 0,
          right: 0,
          bottom: 32,
          child: Center(
            child: RecordingButton(onRecordingStart: _startRecording),
          ),
        ),
      ],
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
        const Spacer(),
        Container(
          padding: const EdgeInsets.only(bottom: 32.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 16),
              RecordingButton(onRecordingStart: _startRecording),
            ],
          ),
        ),
      ],
    );
  }
}
