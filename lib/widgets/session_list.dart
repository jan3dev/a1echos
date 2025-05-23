import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/session_provider.dart';
import '../models/session.dart';
import 'session_list_item.dart';
import 'package:ui_components/ui_components.dart';
import 'empty_transcriptions_state.dart';

class SessionList extends StatelessWidget {
  final bool selectionMode;
  final Set<String> selectedSessionIds;
  final Function(Session) onSessionLongPress;
  final Function(String) onSessionTap;
  final Function(String) onSelectionToggle;

  const SessionList({
    super.key,
    required this.selectionMode,
    required this.selectedSessionIds,
    required this.onSessionLongPress,
    required this.onSessionTap,
    required this.onSelectionToggle,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AquaColors.lightColors;
    return Consumer<SessionProvider>(
      builder: (context, sessionProvider, child) {
        final sessions = sessionProvider.sessions;

        return Container(
          decoration: BoxDecoration(
            color: colors.surfacePrimary,
            borderRadius: BorderRadius.circular(8),
            boxShadow: [
              BoxShadow(
                color: colors.surfaceInverse.withOpacity(0.04),
                blurRadius: 16,
                offset: const Offset(0, 0),
              ),
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
                    selectionMode: selectionMode,
                    isSelected: selectedSessionIds.contains(session.id),
                    onTap:
                        () =>
                            selectionMode
                                ? onSelectionToggle(session.id)
                                : onSessionTap(session.id),
                    onLongPress: () => onSessionLongPress(session),
                  ),
                  if (index < sessions.length - 1)
                    Divider(height: 1, color: colors.surfaceBorderPrimary),
                ],
              );
            }),
          ),
        );
      },
    );
  }
}
