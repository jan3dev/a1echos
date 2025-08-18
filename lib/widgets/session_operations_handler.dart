import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider;
import '../providers/session_provider.dart';
import '../providers/settings_provider.dart';
import '../providers/local_transcription_provider.dart';
import '../screens/session_screen.dart';
import '../constants/app_constants.dart';
import '../logger.dart';

mixin SessionOperationsHandler<T extends StatefulWidget> on State<T> {
  void openSession(String sessionId, {bool selectionMode = false}) {
    if (selectionMode) return;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => SessionScreen(sessionId: sessionId),
      ),
    );
  }

  Future<void> startRecording() async {
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
          null,
          isIncognito: true,
        );
      } else {
        sessionId = await sessionProvider.createSession(null);
      }

      if (!mounted) return;

      final localTranscriptionProvider = provider
          .Provider.of<LocalTranscriptionProvider>(context, listen: false);

      localTranscriptionProvider.startRecording();

      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => SessionScreen(sessionId: sessionId),
        ),
      );
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
          content: Text(
            AppStrings.homeErrorCreatingSession.replaceAll(
              '{error}',
              'An unexpected error occurred.',
            ),
          ),
        ),
      );
    }
  }
}
