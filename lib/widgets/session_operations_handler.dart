import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/session_provider.dart';
import '../providers/settings_provider.dart';
import '../providers/local_transcription_provider.dart';
import '../screens/session_screen.dart';
import '../constants/app_constants.dart';

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
          null,
          isIncognito: true,
        );
      } else {
        sessionId = await sessionProvider.createSession(null);
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
}
