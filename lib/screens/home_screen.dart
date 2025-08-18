import 'package:echos/utils/utils.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/theme_provider.dart';
import '../providers/local_transcription_provider.dart';
import '../providers/session_provider.dart';
import '../providers/settings_provider.dart';
import '../widgets/recording_button.dart';
import '../widgets/home_app_bar.dart';
import '../widgets/home_content.dart';
import '../widgets/selection_mode_handler.dart';
import '../widgets/session_operations_handler.dart';
import '../widgets/aqua_tooltip_with_animation.dart';
import '../widgets/static_wave_bars.dart';
import '../logger.dart';
import '../models/app_theme.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen>
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
      _cleanupIncognitoSessionsIfNeeded();
      final transcriptionProvider = provider
          .Provider.of<LocalTranscriptionProvider>(context, listen: false);
      transcriptionProvider.addListener(_scrollToBottom);
    });
  }

  void _cleanupIncognitoSessionsIfNeeded() {
    final sessionProvider = provider.Provider.of<SessionProvider>(
      context,
      listen: false,
    );
    final settingsProvider = provider.Provider.of<SettingsProvider>(
      context,
      listen: false,
    );
    final localTranscriptionProvider = provider
        .Provider.of<LocalTranscriptionProvider>(context, listen: false);

    if ((!settingsProvider.isIncognitoMode) ||
        (settingsProvider.isIncognitoMode &&
            !localTranscriptionProvider.isRecording)) {
      _deleteIncognitoSessions(sessionProvider);
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
      provider.Provider.of<LocalTranscriptionProvider>(
        context,
        listen: false,
      ).removeListener(_scrollToBottom);
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.ui,
        message: 'Error removing scroll-to-bottom listener on HomeScreen',
      );
    }
    _scrollController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);

    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached ||
        state == AppLifecycleState.resumed) {
      _cleanupIncognitoSessionsIfNeeded();
    }
  }

  void _deleteIncognitoSessions(SessionProvider sessionProvider) {
    final incognitoSessions = sessionProvider.sessions
        .where((session) => session.isIncognito)
        .toList();
    for (var session in incognitoSessions) {
      sessionProvider.deleteSession(session.id);
    }
  }

  bool _calculateEffectivelyEmpty() {
    final sessionProvider = provider.Provider.of<SessionProvider>(context);
    final settingsProvider = provider.Provider.of<SettingsProvider>(context);

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
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = selectedTheme.colors(context);
    final effectivelyEmpty = _calculateEffectivelyEmpty();

    return Scaffold(
      backgroundColor: colors.surfaceBackground,
      appBar: HomeAppBar(
        selectionMode: selectionMode,
        onDeleteSelected: () => deleteSelectedSessions(ref),
        effectivelyEmpty: effectivelyEmpty,
      ),
      body: Stack(
        children: [
          HomeContent(
            scrollController: _scrollController,
            selectionMode: selectionMode,
            selectedSessionIds: selectedSessionIds,
            onSessionLongPress: handleSessionLongPress,
            onSessionTap: (sessionId) =>
                openSession(sessionId, selectionMode: selectionMode),
            onSelectionToggle: toggleSessionSelection,
          ),
          Positioned(
            bottom: 32,
            left: 0,
            right: 0,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: RecordingButton(onRecordingStart: startRecording),
                ),
                const SizedBox(height: 50),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: StaticWaveBars(),
                ),
                const SizedBox(height: 26),
              ],
            ),
          ),
          if (effectivelyEmpty)
            Positioned(
              bottom: 120,
              left: 0,
              right: 0,
              child: AquaTooltipWithAnimation(
                message: context.loc.emptySessionsMessage,
              ),
            ),
        ],
      ),
    );
  }
}
