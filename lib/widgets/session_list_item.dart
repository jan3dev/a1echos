import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:ui_components/ui_components.dart';
import '../models/session.dart';
import '../constants/app_constants.dart';

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
    final String subtitle = '${AppStrings.modifiedPrefix} $formattedDate';
    final colors = AquaColors.lightColors;

    return GestureDetector(
      onLongPress: onLongPress,
      child: AquaListItem(
        title: session.name,
        subtitle: subtitle,
        iconLeading: selectionMode ? _buildCheckbox() : null,
        iconTrailing: selectionMode ? null : AquaIcon.chevronRight(),
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
