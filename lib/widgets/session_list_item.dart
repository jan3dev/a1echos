import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';
import 'package:provider/provider.dart';
import '../models/session.dart';
import '../providers/local_transcription_provider.dart';
import 'menus/session_more_menu.dart';

class SessionListItem extends StatelessWidget {
  final Session session;
  final VoidCallback onTap;
  final VoidCallback onLongPress;
  final bool selectionMode;
  final bool isSelected;

  const SessionListItem({
    super.key,
    required this.session,
    required this.onTap,
    required this.onLongPress,
    this.selectionMode = false,
    this.isSelected = false,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AquaColors.lightColors;
    final transcriptions = Provider.of<LocalTranscriptionProvider>(context).allTranscriptions;
    final count = transcriptions.where((t) => t.sessionId == session.id).length;
    final String subtitle = count == 1
        ? '1 Transcription'
        : '$count Transcriptions';

    return GestureDetector(
      onLongPress: onLongPress,
      child: AquaListItem(
        title: session.name,
        subtitle: subtitle,
        iconLeading: selectionMode ? _buildCheckbox() : null,
        iconTrailing: SessionMoreMenu(
          session: session,
          listItemContext: context,
        ),
        backgroundColor: colors.surfacePrimary,
        titleColor: colors.textPrimary,
        subtitleColor: colors.textSecondary,
        onTap: onTap,
      ),
    );
  }

  Widget _buildCheckbox() {
    return AquaCheckBox.small(value: isSelected, onChanged: (_) {});
  }
}
