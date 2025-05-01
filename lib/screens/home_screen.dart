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

  void _showCreateSessionDialog(BuildContext context) {
    final controller = TextEditingController();
    final sessionProvider = Provider.of<SessionProvider>(
      context,
      listen: false,
    );

    showDialog(
      context: context,
      builder:
          (_) => AlertDialog(
            title: const Text('New Session'),
            content: TextField(
              controller: controller,
              decoration: const InputDecoration(labelText: 'Session name'),
              autofocus: true,
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () async {
                  final name = controller.text.trim();
                  Navigator.pop(context);

                  try {
                    final sessionId = await sessionProvider.createSession(
                      name.isEmpty ? 'New Session' : name,
                    );

                    if (!mounted) return;

                    _openSession(sessionId);
                  } catch (e) {
                    if (!mounted) return;

                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Error creating session: $e')),
                    );
                  }
                },
                child: const Text('Create'),
              ),
            ],
          ),
    );
  }

  void _showRenameDeleteSessionDialog(BuildContext context, Session session) {
    showModalBottomSheet(
      context: context,
      builder: (bottomSheetContext) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.edit),
                title: const Text('Rename Session'),
                onTap: () {
                  Navigator.pop(bottomSheetContext);
                  _showRenameSessionDialog(context, session);
                },
              ),
              ListTile(
                leading: Icon(Icons.delete, color: Colors.red),
                title: Text(
                  'Delete Session',
                  style: TextStyle(color: Colors.red),
                ),
                onTap: () {
                  Navigator.pop(bottomSheetContext);
                  _showConfirmDeleteDialog(context, session);
                },
              ),
            ],
          ),
        );
      },
    );
  }

  void _showRenameSessionDialog(BuildContext context, Session session) {
    final controller = TextEditingController(text: session.name);
    final sessionProvider = Provider.of<SessionProvider>(
      context,
      listen: false,
    );

    showDialog(
      context: context,
      builder:
          (_) => AlertDialog(
            title: const Text('Rename Session'),
            content: TextField(
              controller: controller,
              decoration: const InputDecoration(labelText: 'New name'),
              autofocus: true,
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () {
                  final newName = controller.text.trim();
                  if (newName.isNotEmpty) {
                    sessionProvider.renameSession(session.id, newName);
                  }
                  Navigator.pop(context);
                },
                child: const Text('Rename'),
              ),
            ],
          ),
    );
  }

  void _showConfirmDeleteDialog(BuildContext context, Session session) {
    final sessionProvider = Provider.of<SessionProvider>(
      context,
      listen: false,
    );

    showDialog(
      context: context,
      builder:
          (_) => AlertDialog(
            title: const Text('Delete Session?'),
            content: Text(
              'Are you sure you want to delete "${session.name}"? This action cannot be undone.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel'),
              ),
              TextButton(
                style: TextButton.styleFrom(foregroundColor: Colors.red),
                onPressed: () {
                  sessionProvider.deleteSession(session.id);
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Session "${session.name}" deleted'),
                    ),
                  );
                },
                child: const Text('Delete'),
              ),
            ],
          ),
    );
  }

  void _openSession(String sessionId) {
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
    final controller = TextEditingController(text: initialName);
    final sessionProvider = Provider.of<SessionProvider>(
      context,
      listen: false,
    );

    showDialog(
      context: context,
      barrierDismissible: false,
      builder:
          (_) => AlertDialog(
            title: const Text('Save Recording?'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Do you want to save this recording? If not saved, it will be lost when you restart the app.',
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: controller,
                  decoration: const InputDecoration(labelText: 'Session name'),
                  autofocus: true,
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(context);
                },
                child: const Text('Discard'),
              ),
              TextButton(
                onPressed: () {
                  sessionProvider.deleteSession(sessionId);
                  Navigator.pop(context);
                },
                child: const Text('Delete'),
              ),
              ElevatedButton(
                onPressed: () {
                  final newName = controller.text.trim();
                  if (newName.isNotEmpty) {
                    sessionProvider.saveTemporarySession(sessionId, newName);
                  } else {
                    sessionProvider.makeSessionPermanent(sessionId);
                  }
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Session saved')),
                  );
                },
                child: const Text('Save'),
              ),
            ],
          ),
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
            showRenameDeleteDialog: _showRenameDeleteSessionDialog,
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
