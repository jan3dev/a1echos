import 'package:flutter/material.dart';
import '../models/session.dart';
import '../widgets/session_list.dart';

class HomeContent extends StatelessWidget {
  static const double _recordingControlsHeight = 167;

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
      bottom: 0,
      child: SingleChildScrollView(
        controller: scrollController,
        child: Padding(
          padding: EdgeInsets.only(
            left: 16.0,
            right: 16.0,
            top: 16.0,
            bottom: _recordingControlsHeight,
          ),
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
