import 'package:echos/utils/utils.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/theme_provider.dart';
import '../providers/local_transcription_provider.dart';
import '../providers/session_provider.dart';
import 'package:ui_components/ui_components.dart';
import '../widgets/home_app_bar.dart';
import '../widgets/home_content.dart';
import '../widgets/selection_mode_handler.dart';
import '../widgets/session_operations_handler.dart';
import '../widgets/aqua_tooltip_with_animation.dart';
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
  bool _tooltipShouldDisappear = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final transcriptionProvider = provider
          .Provider.of<LocalTranscriptionProvider>(context, listen: false);
      transcriptionProvider.addListener(_scrollToTop);
    });
  }

  void _scrollToTop() {
    if (_scrollController.hasClients) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollController.hasClients) {
          _scrollController.animateTo(
            0.0, // Scroll to top to show newest sessions
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
      ).removeListener(_scrollToTop);
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.ui,
        message: 'Error removing scroll-to-top listener on HomeScreen',
      );
    }
    _scrollController.dispose();
    super.dispose();
  }

  void _onTooltipDisappearComplete() {
    setState(() {
      _tooltipShouldDisappear = false;
    });
  }

  void _startTooltipDisappearAnimation() {
    setState(() {
      _tooltipShouldDisappear = true;
    });
  }

  Future<void> _startRecordingWithAnimation() async {
    final sessionProvider = provider.Provider.of<SessionProvider>(
      context,
      listen: false,
    );

    bool isCurrentlyEmpty = sessionProvider.sessions.isEmpty;

    await startRecording(
      onTooltipAnimationStart: isCurrentlyEmpty
          ? _startTooltipDisappearAnimation
          : null,
    );

    if (mounted) {
      setState(() {
        _tooltipShouldDisappear = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = selectedTheme.colors(context);

    final sessionProvider = provider.Provider.of<SessionProvider>(context);

    bool effectivelyEmpty = sessionProvider.sessions.isEmpty;

    if (effectivelyEmpty && _tooltipShouldDisappear) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          setState(() {
            _tooltipShouldDisappear = false;
          });
        }
      });
    }

    return PopScope(
      canPop: !selectionMode,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && selectionMode) {
          exitSelectionMode();
        }
      },
      child: Scaffold(
        backgroundColor: colors.surfaceBackground,
        appBar: HomeAppBar(
          selectionMode: selectionMode,
          onDeleteSelected: () {
            deleteSelectedSessions(ref, context, colors);
          },
          onExitSelectionMode: exitSelectionMode,
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
              stableContext: context,
            ),
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
                  onRecordingStart: _startRecordingWithAnimation,
                  onRecordingStop: () =>
                      transcriptionProvider.stopRecordingAndSave(),
                );
              },
            ),
            if (effectivelyEmpty)
              Positioned(
                bottom: 160,
                left: 0,
                right: 0,
                child: AquaTooltipWithAnimation(
                  message: context.loc.emptySessionsMessage,
                  shouldDisappear: _tooltipShouldDisappear,
                  onDisappearComplete: _onTooltipDisappearComplete,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
