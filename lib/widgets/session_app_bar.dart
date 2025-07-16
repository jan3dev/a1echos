import 'package:flutter/material.dart';
import 'package:flutter_svg/svg.dart';
import 'package:ui_components/ui_components.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../constants/app_constants.dart';
import '../providers/theme_provider.dart';
import '../models/app_theme.dart';

/// App bar component for the session screen that handles both normal and selection modes
class SessionAppBar extends ConsumerWidget implements PreferredSizeWidget {
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
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = selectedTheme.colors(context);

    return AquaTopAppBar(
      colors: colors,
      onBackPressed: onBackPressed,
      title: sessionName,
      actions: selectionMode ? _buildSelectionActions(colors) : _buildNormalActions(colors),
      onTitlePressed: !isIncognitoSession ? onTitlePressed : null,
    );
  }

  List<Widget> _buildNormalActions(AquaColors colors) {
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

  List<Widget> _buildSelectionActions(AquaColors colors) {
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
        icon: AquaIcon.trash(color: colors.textPrimary),
        onPressed: onDeleteSelectedPressed,
        tooltip: AppStrings.deleteSelected,
      ),
    ];
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}
