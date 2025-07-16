import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ui_components/ui_components.dart';
import '../constants/app_constants.dart';
import '../providers/theme_provider.dart';
import '../models/app_theme.dart';

class ThemeSelectionScreen extends ConsumerWidget {
  const ThemeSelectionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final notifier = ref.read(prefsProvider.notifier);
    final colors = selectedTheme.colors(context);
    return Scaffold(
      backgroundColor: colors.surfaceBackground,
      appBar: AquaTopAppBar(colors: colors, title: AppStrings.themeTitle),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Container(
          decoration: BoxDecoration(
            color: colors.surfacePrimary,
            borderRadius: BorderRadius.circular(8),
            boxShadow: [
              BoxShadow(
                color: colors.surfaceInverse.withOpacity(0.04),
                blurRadius: 16,
                offset: const Offset(0, 0),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AquaListItem(
                title: AppStrings.auto,
                iconTrailing: AquaRadio<AppTheme>(
                  value: AppTheme.auto,
                  groupValue: selectedTheme,
                  onChanged: (_) {
                    notifier.switchTheme(AppTheme.auto);
                    Navigator.of(context).pop();
                  },
                ),
                onTap: () {
                  notifier.switchTheme(AppTheme.auto);
                  Navigator.of(context).pop();
                },
                backgroundColor: colors.surfacePrimary,
              ),
              Divider(height: 1, color: colors.surfaceBorderPrimary),
              AquaListItem(
                title: AppStrings.light,
                iconTrailing: AquaRadio<AppTheme>(
                  value: AppTheme.light,
                  groupValue: selectedTheme,
                  onChanged: (_) {
                    notifier.switchTheme(AppTheme.light);
                    Navigator.of(context).pop();
                  },
                ),
                onTap: () {
                  notifier.switchTheme(AppTheme.light);
                  Navigator.of(context).pop();
                },
                backgroundColor: colors.surfacePrimary,
              ),
              Divider(height: 1, color: colors.surfaceBorderPrimary),
              AquaListItem(
                title: AppStrings.dark,
                iconTrailing: AquaRadio<AppTheme>(
                  value: AppTheme.dark,
                  groupValue: selectedTheme,
                  onChanged: (_) {
                    notifier.switchTheme(AppTheme.dark);
                    Navigator.of(context).pop();
                  },
                ),
                onTap: () {
                  notifier.switchTheme(AppTheme.dark);
                  Navigator.of(context).pop();
                },
                backgroundColor: colors.surfacePrimary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
