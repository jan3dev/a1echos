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
    final colors = AquaColors.lightColors;

    return [
      IconButton(
        iconSize: 24,
        icon: SvgPicture.asset(
          'assets/icons/copy-multiple.svg',
          colorFilter: ColorFilter.mode(colors.textPrimary, BlendMode.srcIn),
        ),
        onPressed: onCopyAllPressed,
        tooltip: AppStrings.copyAllTooltip,
      ),
    ];
  }

  List<Widget> _buildSelectionActions() {
    final colors = AquaColors.lightColors;

    return [
      IconButton(
        iconSize: 24,
        icon: SvgPicture.asset(
          'assets/icons/select-all.svg',
          colorFilter: ColorFilter.mode(colors.textPrimary, BlendMode.srcIn),
        ),
        onPressed: onSelectAllPressed,
        tooltip: AppStrings.selectAll,
      ),
      IconButton(
        iconSize: 24,
        icon: AquaIcon.trash(),
        onPressed: onDeleteSelectedPressed,
        tooltip: AppStrings.deleteSelected,
      ),
    ];
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}
