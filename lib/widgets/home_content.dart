import 'package:flutter/material.dart';
import '../models/session.dart';
import '../widgets/session_list.dart';

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
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      bottom: 208,
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
}
