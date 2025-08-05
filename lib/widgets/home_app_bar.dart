import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider;
import 'package:flutter_svg/flutter_svg.dart';
import 'package:ui_components/ui_components.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/settings_provider.dart';
import '../screens/settings_screen.dart';
import '../providers/theme_provider.dart';
import '../models/app_theme.dart';
import '../widgets/modals/incognito_explainer_modal.dart';

class HomeAppBar extends ConsumerWidget implements PreferredSizeWidget {
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
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = selectedTheme.colors(context);
    final settingsProvider = provider.Provider.of<SettingsProvider>(context);

    return AppBar(
      backgroundColor: colors.surfaceBackground,
      elevation: 0,
      leadingWidth: effectivelyEmpty || selectionMode ? 56 : 0,
      automaticallyImplyLeading: false,
      titleSpacing: 16,
      title: Row(
        children: [
          SvgPicture.asset(
            'assets/icons/echos-logo.svg',
            colorFilter: ColorFilter.mode(colors.textPrimary, BlendMode.srcIn),
          ),
          const SizedBox(width: 10),
          AquaText.subtitleSemiBold(text: 'Echos', color: colors.textPrimary),
        ],
      ),
      actions: [
        if (selectionMode) ...[
          AquaIcon.trash(
            color: colors.textPrimary,
            size: 24,
            onTap: onDeleteSelected,
          ),
        ] else ...[
          IconButton(
            iconSize: 24,
            icon: SvgPicture.asset(
              'assets/icons/ghost.svg',
              colorFilter: ColorFilter.mode(
                settingsProvider.isIncognitoMode
                    ? colors.accentBrand
                    : colors.textPrimary,
                BlendMode.srcIn,
              ),
            ),
            onPressed: () async {
              final newValue = !settingsProvider.isIncognitoMode;
              final shouldShowModal =
                  newValue && !settingsProvider.hasSeenIncognitoExplainer;

              await settingsProvider.setIncognitoMode(newValue);

              if (!context.mounted) return;

              if (shouldShowModal) {
                IncognitoExplainerModal.show(
                  context: context,
                  ref: ref,
                  onDismiss: () async {
                    await settingsProvider.markIncognitoExplainerSeen();
                    if (context.mounted) Navigator.pop(context);
                  },
                );
              }
            },
            tooltip: settingsProvider.isIncognitoMode
                ? 'Turn off Incognito Mode'
                : 'Turn on Incognito Mode',
            color: settingsProvider.isIncognitoMode
                ? colors.accentBrand
                : colors.textPrimary,
          ),
          AquaIcon.hamburger(
            color: colors.textPrimary,
            size: 24,
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const SettingsScreen()),
              );
            },
          ),
        ],
        const SizedBox(width: 8),
      ],
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}
