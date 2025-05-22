import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:ui_components/ui_components.dart';
import '../providers/local_transcription_provider.dart';
import '../providers/session_provider.dart';
import '../providers/settings_provider.dart';
import '../models/session.dart';
import '../widgets/incognito_toggle_item.dart';
import '../widgets/recording_button.dart';
import 'settings_screen.dart';
import 'dart:developer' as developer;
import '../widgets/session_list.dart';
import 'session_screen.dart';
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

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);

    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      final sessionProvider = Provider.of<SessionProvider>(
        context,
        listen: false,
      );
      final settingsProvider = Provider.of<SettingsProvider>(
        context,
        listen: false,
      );

      if (settingsProvider.isIncognitoMode) {
        final incognitoSessions =
            sessionProvider.sessions
                .where((session) => session.isIncognito)
                .toList();
        for (var session in incognitoSessions) {
          sessionProvider.deleteSession(session.id);
        }
      }
    }
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

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => SessionScreen(sessionId: sessionId),
      ),
    );
  }

  void _startRecording() async {
    final sessionProvider = Provider.of<SessionProvider>(
      context,
      listen: false,
    );
    final settingsProvider = Provider.of<SettingsProvider>(
      context,
      listen: false,
    );

    try {
      String sessionId;
      if (settingsProvider.isIncognitoMode) {
        sessionId = await sessionProvider.createSession(
          AppStrings.recordingPrefix,
          isIncognito: true,
        );
      } else {
        sessionId = await sessionProvider.createSession(AppStrings.recordingPrefix);
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
      ).then((_) {});
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

  @override
  Widget build(BuildContext context) {
    final colors = AquaColors.lightColors;
    final sessionProvider = Provider.of<SessionProvider>(context);
    final settingsProvider = Provider.of<SettingsProvider>(context);

    bool effectivelyEmpty = sessionProvider.sessions.isEmpty;
    if (sessionProvider.sessions.length == 1 &&
        sessionProvider.sessions.first.isIncognito) {
      if (settingsProvider.isIncognitoMode) {
        effectivelyEmpty = true;
      } else {
        effectivelyEmpty = false;
      }
    }
    if (sessionProvider.sessions.length > 1) effectivelyEmpty = false;

    return Scaffold(
      backgroundColor: colors.surfaceBackground,
      appBar: AppBar(
        backgroundColor: colors.surfaceBackground,
        elevation: 0,
        leadingWidth: effectivelyEmpty || _selectionMode ? 56 : 0,
        automaticallyImplyLeading: false,
        titleSpacing: _selectionMode ? 0 : 16,
        leading:
            _selectionMode
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
            !_selectionMode
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
            if (!_selectionMode)
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
          Column(
            children: [
              const IncognitoToggleItem(),
              Expanded(
                child:
                    effectivelyEmpty
                        ? const EmptyTranscriptionsState()
                        : _buildSessionList(),
              ),
            ],
          ),
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
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 24),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: Text(
            AppStrings.homeSessionsTitle,
            style: AquaTypography.body1SemiBold.copyWith(
              color: AquaColors.lightColors.textPrimary,
            ),
            textAlign: TextAlign.left,
          ),
        ),
        const SizedBox(height: 16),
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
