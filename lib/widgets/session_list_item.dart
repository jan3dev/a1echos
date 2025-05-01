import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:ui_components/ui_components.dart';
import '../models/session.dart';

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
    final String formattedDate = DateFormat(
      'MMM d, h:mm a',
    ).format(session.lastModified);
    final String subtitle = 'Modified $formattedDate';

    return GestureDetector(
      onLongPress: onLongPress,
      child: AquaListItem(
        title: session.name,
        subtitle: subtitle,
        iconLeading: selectionMode ? _buildCheckbox() : null,
        iconTrailing: selectionMode ? null : AquaIcon.chevronRight(),
        backgroundColor: AquaColors.lightColors.surfacePrimary,
        titleColor: Theme.of(context).textTheme.titleMedium?.color,
        subtitleColor: Theme.of(context).textTheme.bodySmall?.color,
        onTap: onTap,
      ),
    );
  }

  Widget _buildCheckbox() {
    return AquaCheckBox.small(value: isSelected, onChanged: (_) {});
  }
}
