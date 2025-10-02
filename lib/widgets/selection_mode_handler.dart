import 'package:echos/utils/utils.dart';
import 'package:echos/widgets/toast/confirmation_toast.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/session_provider.dart';
import '../models/session.dart';

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

  void handleSessionLongPress(Session session) {
    if (!_selectionMode) {
      setState(() {
        _selectionMode = true;
        _selectedSessionIds.add(session.id);
      });
    }
  }

  void deleteSelectedSessions(WidgetRef ref) {
    final sessionProvider = provider.Provider.of<SessionProvider>(
      context,
      listen: false,
    );

    if (_selectedSessionIds.isEmpty) return;

    ConfirmationToast.show(
      context: context,
      ref: ref,
      title: context.loc.homeDeleteSelectedSessionsTitle,
      message: context.loc.homeDeleteSelectedSessionsMessage(
        _selectedSessionIds.length,
      ),
      confirmText: context.loc.delete,
      cancelText: context.loc.cancel,
      onConfirm: () {
        Navigator.pop(context);
        final deletedCount = _selectedSessionIds.length;
        for (var sessionId in _selectedSessionIds) {
          sessionProvider.deleteSession(sessionId);
        }
        setState(() {
          _selectionMode = false;
          _selectedSessionIds.clear();
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(context.loc.homeSessionsDeleted(deletedCount)),
          ),
        );
      },
    );
  }
}
