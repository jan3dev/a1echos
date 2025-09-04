import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider;
import 'package:echos/utils/utils.dart';
import '../providers/session_provider.dart';
import '../providers/settings_provider.dart';
import '../providers/local_transcription_provider.dart';
import '../screens/session_screen.dart';
import '../logger.dart';

mixin SessionOperationsHandler<T extends StatefulWidget> on State<T> {
  void openSession(String sessionId, {bool selectionMode = false}) {
    if (selectionMode) return;

    Navigator.push(
      context,
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            SessionScreen(sessionId: sessionId),
        transitionDuration: Duration.zero,
        reverseTransitionDuration: Duration.zero,
      ),
    );
  }

  Future<void> startRecording({VoidCallback? onTooltipAnimationStart}) async {
    if (onTooltipAnimationStart != null) {
      onTooltipAnimationStart();
      // Wait for tooltip animation to complete before proceeding (shrink-in effect = 250ms)
      await Future.delayed(const Duration(milliseconds: 270));
    }
    if (!mounted) return;

    final sessionProvider = provider.Provider.of<SessionProvider>(
      context,
      listen: false,
    );
    final settingsProvider = provider.Provider.of<SettingsProvider>(
      context,
      listen: false,
    );

    try {
      String sessionId;
      if (settingsProvider.isIncognitoMode) {
        sessionId = await sessionProvider.createSession(
          context,
          null,
          isIncognito: true,
          notifyListenersImmediately: false,
        );
      } else {
        sessionId = await sessionProvider.createSession(
          context,
          null,
          notifyListenersImmediately: false,
        );
      }

      if (!mounted) return;

      final localTranscriptionProvider = provider
          .Provider.of<LocalTranscriptionProvider>(context, listen: false);
      localTranscriptionProvider.startRecording();

      await Future.delayed(const Duration(milliseconds: 50));

      if (!mounted) return;

      Navigator.push(
        context,
        PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) =>
              SessionScreen(sessionId: sessionId),
          transitionDuration: Duration.zero,
          reverseTransitionDuration: Duration.zero,
        ),
      );

      sessionProvider.notifySessionCreated();
    } catch (e, st) {
      if (!mounted) return;
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.ui,
        message: 'Failed to start recording from SessionOperationsHandler',
      );

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(context.loc.homeErrorCreatingSession(e.toString())),
        ),
      );
    }
  }
}
