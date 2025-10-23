import 'package:echos/utils/utils.dart';
import 'package:echos/widgets/toast/confirmation_toast.dart';
import 'package:flutter/material.dart';
import 'package:haptic_feedback/haptic_feedback.dart';
import 'package:provider/provider.dart' as provider;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ui_components/ui_components.dart';
import '../providers/session_provider.dart';
import '../models/session.dart';
import '../logger.dart';

mixin SelectionModeHandler<T extends StatefulWidget> on State<T> {
  bool _selectionMode = false;
  final Set<String> _selectedSessionIds = {};

  bool get selectionMode => _selectionMode;
  Set<String> get selectedSessionIds => _selectedSessionIds;

  void toggleSessionSelection(String sessionId) {
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

  void handleSessionLongPress(Session session) async {
    if (!_selectionMode) {
      setState(() {
        _selectionMode = true;
        _selectedSessionIds.add(session.id);
      });
      final canVibrate = await Haptics.canVibrate();
      if (canVibrate) {
        Haptics.vibrate(HapticsType.heavy);
      }
    }
  }

  void exitSelectionMode() {
    setState(() {
      _selectionMode = false;
      _selectedSessionIds.clear();
    });
  }

  void deleteSelectedSessions(
    WidgetRef ref,
    BuildContext? callerContext,
    AquaColors? colors,
  ) {
    final sessionProvider = provider.Provider.of<SessionProvider>(
      context,
      listen: false,
    );

    if (_selectedSessionIds.isEmpty) {
      return;
    }

    ConfirmationToast.show(
      context: context,
      ref: ref,
      title: context.loc.homeDeleteSelectedSessionsTitle,
      message: context.loc.homeDeleteSelectedSessionsMessage(
        _selectedSessionIds.length,
      ),
      confirmText: context.loc.delete,
      cancelText: context.loc.cancel,
      onConfirm: () async {
        final deletedCount = _selectedSessionIds.length;
        Navigator.pop(context);

        // Wait for dialog to fully dismiss
        await Future.delayed(const Duration(milliseconds: 300));

        // Show tooltip BEFORE deletions to capture stable context
        if (mounted && callerContext != null && colors != null) {
          try {
            AquaTooltip.show(
              callerContext,
              message: callerContext.loc.homeSessionsDeleted(deletedCount),
              colors: colors,
            );
          } catch (e) {
            logger.error('AquaTooltip.show failed: $e', flag: FeatureFlag.ui);
          }
        }

        // Delete all sessions (this triggers rebuilds)
        for (var sessionId in _selectedSessionIds) {
          await sessionProvider.deleteSession(sessionId);
        }

        // Clear selection state
        if (mounted) {
          setState(() {
            _selectionMode = false;
            _selectedSessionIds.clear();
          });
        }
      },
    );
  }
}
