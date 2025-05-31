import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:ui_components/ui_components.dart';
import '../providers/settings_provider.dart';
import '../screens/settings_screen.dart';
import '../constants/app_constants.dart';

class HomeAppBar extends StatelessWidget implements PreferredSizeWidget {
  final bool selectionMode;
  final VoidCallback? onDeleteSelected;
  final bool effectivelyEmpty;

  const HomeAppBar({
    super.key,
    required this.selectionMode,
    this.onDeleteSelected,
    required this.effectivelyEmpty,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AquaColors.lightColors;
    final settingsProvider = Provider.of<SettingsProvider>(context);

    return AppBar(
      backgroundColor: colors.surfaceBackground,
      elevation: 0,
      leadingWidth: effectivelyEmpty || selectionMode ? 56 : 0,
      automaticallyImplyLeading: false,
      titleSpacing: 16,
      title: SvgPicture.asset('assets/icons/echo-logo.svg'),
      actions: [
        if (selectionMode) ...[
          IconButton(
            icon: AquaIcon.trash(),
            onPressed: onDeleteSelected,
            tooltip: AppStrings.deleteSelected,
            color: colors.textPrimary,
          ),
        ] else ...[
          IconButton(
            icon: SvgPicture.asset(
              'assets/icons/ghost.svg',
              width: 24,
              height: 24,
              colorFilter: ColorFilter.mode(
                settingsProvider.isIncognitoMode
                    ? colors.accentBrand
                    : colors.textPrimary,
                BlendMode.srcIn,
              ),
            ),
            onPressed: () async {
              await settingsProvider.setIncognitoMode(
                !settingsProvider.isIncognitoMode,
              );
            },
            tooltip:
                settingsProvider.isIncognitoMode
                    ? 'Turn off Incognito Mode'
                    : 'Turn on Incognito Mode',
            color:
                settingsProvider.isIncognitoMode
                    ? colors.accentBrand
                    : colors.textPrimary,
          ),
          IconButton(
            icon: AquaIcon.hamburger(),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const SettingsScreen()),
              );
            },
            tooltip: AppStrings.settingsTooltip,
            color: colors.textPrimary,
          ),
        ],
        const SizedBox(width: 8),
      ],
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}
