import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:echos/utils/utils.dart';
import 'package:ui_components/ui_components.dart';
import '../providers/session_provider.dart';
import '../providers/settings_provider.dart';
import '../providers/local_transcription_provider.dart';
import '../providers/theme_provider.dart';
import '../models/app_theme.dart';
import '../services/audio_service.dart';
import '../utils/permission_dialogs.dart';
import '../screens/session_screen.dart';
import '../logger.dart';

mixin SessionOperationsHandler<T extends StatefulWidget> on State<T> {
  AquaColors? _getColors() {
    if (this is ConsumerState) {
      final consumerState = this as ConsumerState;
      return consumerState.ref
          .watch(prefsProvider)
          .selectedTheme
          .colors(context);
    }
    return Theme.of(context).extension<AquaColors>();
  }

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
    final audioService = AudioService();
    final hasPermission = await audioService.hasPermission();

    if (!hasPermission) {
      if (!mounted) {
        return;
      }

      final colors = _getColors();
      if (colors == null) {
        return;
      }

      final isPermanentlyDenied = await audioService.isPermanentlyDenied();

      if (!mounted) return;

      if (isPermanentlyDenied) {
        PermissionDialogs.showMicrophonePermanentlyDenied(context, colors);
      } else {
        PermissionDialogs.showMicrophonePermissionDenied(
          context,
          colors,
          onRetry: () async {
            await Future.delayed(const Duration(milliseconds: 300));
            startRecording(onTooltipAnimationStart: onTooltipAnimationStart);
          },
        );
      }
      return;
    }

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

      final colors = _getColors();
      if (colors != null) {
        AquaTooltip.show(
          context,
          message: context.loc.homeErrorCreatingSession(e.toString()),
          variant: AquaTooltipVariant.error,
          colors: colors,
        );
      }
    }
  }
}
