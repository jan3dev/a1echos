import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ui_components/ui_components.dart';
import '../providers/local_transcription_provider.dart';
import '../providers/session_provider.dart';
import '../providers/settings_provider.dart';
import '../widgets/recording_button.dart';
import '../widgets/home_app_bar.dart';
import '../widgets/home_content.dart';
import '../widgets/selection_mode_handler.dart';
import '../widgets/session_operations_handler.dart';
import 'dart:developer' as developer;

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with
        WidgetsBindingObserver,
        SelectionModeHandler,
        SessionOperationsHandler {
  final ScrollController _scrollController = ScrollController();

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
  void didChangeAppLifecycleState(AppLifecycleState state) async {
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

  bool _calculateEffectivelyEmpty() {
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

    return effectivelyEmpty;
  }

  @override
  Widget build(BuildContext context) {
    final colors = AquaColors.lightColors;
    final effectivelyEmpty = _calculateEffectivelyEmpty();

    return Scaffold(
      backgroundColor: colors.surfaceBackground,
      appBar: HomeAppBar(
        selectionMode: selectionMode,
        onDeleteSelected: deleteSelectedSessions,
        effectivelyEmpty: effectivelyEmpty,
      ),
      body: Stack(
        children: [
          HomeContent(
            scrollController: _scrollController,
            selectionMode: selectionMode,
            selectedSessionIds: selectedSessionIds,
            onSessionLongPress: handleSessionLongPress,
            onSessionTap:
                (sessionId) =>
                    openSession(sessionId, selectionMode: selectionMode),
            onSelectionToggle: toggleSessionSelection,
          ),
          Positioned(
            bottom: 32,
            left: 0,
            right: 0,
            child: Center(
              child: RecordingButton(onRecordingStart: startRecording),
            ),
          ),
        ],
      ),
    );
  }
}
