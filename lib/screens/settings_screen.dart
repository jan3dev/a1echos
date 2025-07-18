import 'package:flutter/material.dart';
import 'package:flutter_svg/svg.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ui_components/ui_components.dart';
import 'package:provider/provider.dart' as provider;
import '../providers/theme_provider.dart';
import '../providers/local_transcription_provider.dart';
import '../models/model_type.dart';
import '../constants/app_constants.dart';
import '../widgets/aqua_in_app_banner.dart';
import '../widgets/settings_footer.dart';
import '../models/app_theme.dart';
import 'model_selection_screen.dart';
import 'theme_selection_screen.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = selectedTheme.colors(context);
    return Scaffold(
      backgroundColor: colors.surfaceBackground,
      appBar: AquaTopAppBar(colors: colors, title: AppStrings.settingsTitle),
      body: provider.Consumer<LocalTranscriptionProvider>(
        builder: (context, provider, child) {
          String modelDisplay;
          if (provider.selectedModelType == ModelType.vosk) {
            modelDisplay = AppStrings.voskModelTitle;
          } else {
            modelDisplay = provider.whisperRealtime
                ? AppStrings.whisperModelRealtimeTitle
                : AppStrings.whisperModelFileTitle;
          }
          String themeDisplay = selectedTheme.name;

          return Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Container(
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
                          children: [
                            AquaListItem(
                              title: AppStrings.modelTitle,
                              titleTrailing: modelDisplay,
                              titleTrailingColor: colors.textSecondary,
                              iconLeading: SvgPicture.asset(
                                'assets/icons/mic.svg',
                                width: 24,
                                height: 24,
                                colorFilter: ColorFilter.mode(
                                  colors.textSecondary,
                                  BlendMode.srcIn,
                                ),
                              ),
                              iconTrailing: AquaIcon.chevronRight(
                                color: colors.textSecondary,
                              ),
                              onTap: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => ModelSelectionScreen(),
                                  ),
                                );
                              },
                              backgroundColor: colors.surfacePrimary,
                            ),
                            Divider(
                              height: 1,
                              color: colors.surfaceBorderPrimary,
                            ),
                            AquaListItem(
                              title: AppStrings.themeTitle,
                              titleTrailing: themeDisplay,
                              titleTrailingColor: colors.textSecondary,
                              iconLeading: AquaIcon.theme(
                                color: colors.textSecondary,
                                size: 24,
                              ),
                              iconTrailing: AquaIcon.chevronRight(
                                color: colors.textSecondary,
                              ),
                              onTap: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => ThemeSelectionScreen(),
                                  ),
                                );
                              },
                              backgroundColor: colors.surfacePrimary,
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.only(top: 24, bottom: 24),
                        child: const AquaInAppBanner(),
                      ),
                    ],
                  ),
                ),
              ),
              const SettingsFooter(),
            ],
          );
        },
      ),
    );
  }
}
