import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';
import '../models/session.dart';
import '../constants/app_constants.dart';
import '../utils/session_formatter.dart';
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
    final String subtitle = formatSessionSubtitle(
      now: DateTime.now(),
      created: session.timestamp,
      lastModified: session.lastModified,
      modifiedPrefix: AppStrings.modifiedPrefix,
    );

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
