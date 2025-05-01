import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/session_provider.dart';
import '../models/session.dart';
import 'session_list_item.dart';
import '../screens/session_screen.dart';
import 'package:ui_components/ui_components.dart';

class SessionList extends StatelessWidget {
  final Function(BuildContext, Session) showRenameDeleteDialog;

  const SessionList({super.key, required this.showRenameDeleteDialog});

  @override
  Widget build(BuildContext context) {
    return Consumer<SessionProvider>(
      builder: (context, sessionProvider, child) {
        final sessions = sessionProvider.sessions;

        if (sessions.isEmpty) {
          return const Center(child: Text('No sessions found.'));
        }

        return Container(
          decoration: BoxDecoration(
            color: AquaColors.lightColors.surfacePrimary,
            borderRadius: BorderRadius.circular(8),
            boxShadow: [
              BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 16),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: List.generate(sessions.length, (index) {
              final session = sessions[index];

              return Column(
                children: [
                  SessionListItem(
                    session: session,
                    onTap: () => _openSession(context, session.id),
                    onLongPress: () => showRenameDeleteDialog(context, session),
                  ),
                  if (index < sessions.length - 1)
                    Divider(
                      height: 1,
                      color: AquaColors.lightColors.surfaceBorderSecondary,
                    ),
                ],
              );
            }),
          ),
        );
      },
    );
  }

  void _openSession(BuildContext context, String sessionId) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => SessionScreen(sessionId: sessionId),
      ),
    );
  }
}
