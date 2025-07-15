import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/session_provider.dart';
import '../models/session.dart';
import '../widgets/modals/confirmation_modal.dart';
import '../constants/app_constants.dart';

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

  void deleteSelectedSessions() {
    final sessionProvider = Provider.of<SessionProvider>(
      context,
      listen: false,
    );

    if (_selectedSessionIds.isEmpty) return;

    ConfirmationModal.show(
      context: context,
      title: AppStrings.homeDeleteSelectedSessionsTitle,
      message: AppStrings.homeDeleteSelectedSessionsMessage
          .replaceAll(
            '{count}',
            _selectedSessionIds.length == 1 ? 'this' : 'these',
          )
          .replaceAll(
            '{sessions}',
            _selectedSessionIds.length == 1 ? 'session' : 'sessions',
          ),
      confirmText: AppStrings.delete,
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
            content: Text(
              AppStrings.homeSessionsDeleted.replaceAll(
                '{sessions}',
                deletedCount == 1 ? 'Session' : 'Sessions',
              ),
            ),
          ),
        );
      },
    );
  }
}
