import 'package:flutter/material.dart';
import 'package:flutter_svg/svg.dart';
import 'package:ui_components/ui_components.dart';
import '../constants/app_constants.dart';

/// App bar component for the session screen that handles both normal and selection modes
class SessionAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String sessionName;
  final bool selectionMode;
  final bool isIncognitoSession;
  final VoidCallback? onBackPressed;
  final VoidCallback? onTitlePressed;
  final VoidCallback? onEditPressed;
  final VoidCallback? onCopyAllPressed;
  final VoidCallback? onSelectAllPressed;
  final VoidCallback? onDeleteSelectedPressed;

  const SessionAppBar({
    super.key,
    required this.sessionName,
    required this.selectionMode,
    required this.isIncognitoSession,
    this.onBackPressed,
    this.onTitlePressed,
    this.onEditPressed,
    this.onCopyAllPressed,
    this.onSelectAllPressed,
    this.onDeleteSelectedPressed,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AquaColors.lightColors;

    return AquaTopAppBar(
      colors: colors,
      onBackPressed: onBackPressed,
      title: sessionName,
      actions: selectionMode ? _buildSelectionActions() : _buildNormalActions(),
      onTitlePressed: !isIncognitoSession ? onTitlePressed : null,
    );
  }

  List<Widget> _buildNormalActions() {
    return [
      if (!isIncognitoSession) ...[
        IconButton(
          icon: AquaIcon.edit(),
          onPressed: onEditPressed,
          tooltip: AppStrings.sessionRenameTitle,
        ),
      ],
      IconButton(
        icon: SvgPicture.asset('assets/icons/copy-multiple.svg'),
        onPressed: onCopyAllPressed,
        tooltip: AppStrings.copyAllTooltip,
      ),
    ];
  }

  List<Widget> _buildSelectionActions() {
    return [
      IconButton(
        icon: SvgPicture.asset('assets/icons/select-all.svg'),
        onPressed: onSelectAllPressed,
        tooltip: AppStrings.selectAll,
      ),
      IconButton(
        icon: AquaIcon.trash(),
        onPressed: onDeleteSelectedPressed,
        tooltip: AppStrings.deleteSelected,
      ),
    ];
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}
