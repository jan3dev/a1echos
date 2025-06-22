import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/session_provider.dart';
import '../providers/settings_provider.dart';
import '../models/session.dart';
import '../widgets/session_list.dart';
import '../widgets/empty_transcriptions_state.dart';

class HomeContent extends StatelessWidget {
  final ScrollController scrollController;
  final bool selectionMode;
  final Set<String> selectedSessionIds;
  final Function(Session) onSessionLongPress;
  final Function(String) onSessionTap;
  final Function(String) onSelectionToggle;

  const HomeContent({
    super.key,
    required this.scrollController,
    required this.selectionMode,
    required this.selectedSessionIds,
    required this.onSessionLongPress,
    required this.onSessionTap,
    required this.onSelectionToggle,
  });

  @override
  Widget build(BuildContext context) {
    final sessionProvider = Provider.of<SessionProvider>(context);
    final settingsProvider = Provider.of<SettingsProvider>(context);

    bool effectivelyEmpty = _calculateEffectivelyEmpty(
      sessionProvider,
      settingsProvider,
    );

    if (effectivelyEmpty) {
      return const EmptyTranscriptionsState();
    }

    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      bottom: 128,
      child: SingleChildScrollView(
        controller: scrollController,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 16.0),
          child: SessionList(
            selectionMode: selectionMode,
            selectedSessionIds: selectedSessionIds,
            onSessionLongPress: onSessionLongPress,
            onSessionTap: onSessionTap,
            onSelectionToggle: onSelectionToggle,
          ),
        ),
      ),
    );
  }

  bool _calculateEffectivelyEmpty(
    SessionProvider sessionProvider,
    SettingsProvider settingsProvider,
  ) {
    bool effectivelyEmpty = sessionProvider.sessions.isEmpty;

    if (sessionProvider.sessions.length == 1 &&
        sessionProvider.sessions.first.isIncognito) {
      if (settingsProvider.isIncognitoMode) {
        effectivelyEmpty = true;
      } else {
        effectivelyEmpty = false;
      }
    }

    if (sessionProvider.sessions.length > 1) {
      effectivelyEmpty = false;
    }

    return effectivelyEmpty;
  }
}
