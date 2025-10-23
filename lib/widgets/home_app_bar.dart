import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider;
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
  final VoidCallback? onExitSelectionMode;
  final bool effectivelyEmpty;

  const HomeAppBar({
    super.key,
    required this.selectionMode,
    this.onDeleteSelected,
    this.onExitSelectionMode,
    required this.effectivelyEmpty,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = selectedTheme.colors(context);
    final settingsProvider = provider.Provider.of<SettingsProvider>(context);

    return AquaTopAppBar(
      colors: colors,
      showBackButton: false,
      leading: selectionMode
          ? AquaIcon.chevronLeft(
              color: colors.textPrimary,
              size: 24,
              onTap: onExitSelectionMode,
            )
          : AquaIcon.echosLogo(color: colors.textPrimary),
      actions: [
        if (selectionMode) ...[
          AquaIcon.trash(
            color: colors.textPrimary,
            size: 24,
            onTap: onDeleteSelected,
          ),
        ] else ...[
          AquaIcon.ghost(
            size: 24,
            color: settingsProvider.isIncognitoMode
                ? colors.accentBrand
                : colors.textPrimary,
            onTap: () async {
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
          ),
          const SizedBox(width: 8),
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
      ],
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kAppBarHeight);
}
