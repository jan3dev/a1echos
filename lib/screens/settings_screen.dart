import 'package:flutter/material.dart';
import 'package:flutter_svg/svg.dart';
import 'package:provider/provider.dart';
import 'package:ui_components/ui_components.dart';
import '../providers/local_transcription_provider.dart';
import '../models/model_type.dart';
import '../constants/app_constants.dart';
import '../widgets/aqua_in_app_banner.dart';
import '../widgets/settings_footer.dart';
import 'model_selection_screen.dart';
import 'theme_selection_screen.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final aquaColors = AquaColors.lightColors;
    return Scaffold(
      backgroundColor: aquaColors.surfaceBackground,
      appBar: AquaTopAppBar(
        colors: aquaColors,
        title: AppStrings.settingsTitle,
      ),
      body: Consumer<LocalTranscriptionProvider>(
        builder: (context, provider, child) {
          String modelDisplay;
          if (provider.selectedModelType == ModelType.vosk) {
            modelDisplay = AppStrings.voskModelTitle;
          } else {
            modelDisplay = provider.whisperRealtime
                ? AppStrings.whisperModelRealtimeTitle
                : AppStrings.whisperModelFileTitle;
          }
          // TODO: Replace with actual theme provider logic
          String themeDisplay = 'Auto';

          return Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Container(
                        decoration: BoxDecoration(
                          color: aquaColors.surfacePrimary,
                          borderRadius: BorderRadius.circular(8),
                          boxShadow: [
                            BoxShadow(
                              color: aquaColors.surfaceInverse.withOpacity(
                                0.04,
                              ),
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
                              titleTrailingColor: aquaColors.textSecondary,
                              iconLeading: SvgPicture.asset(
                                'assets/icons/mic.svg',
                                width: 24,
                                height: 24,
                                colorFilter: ColorFilter.mode(
                                  aquaColors.textSecondary,
                                  BlendMode.srcIn,
                                ),
                              ),
                              iconTrailing: AquaIcon.chevronRight(),
                              onTap: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => ModelSelectionScreen(),
                                  ),
                                );
                              },
                              backgroundColor: aquaColors.surfacePrimary,
                            ),
                            Divider(
                              height: 1,
                              color: aquaColors.surfaceBorderPrimary,
                            ),
                            AquaListItem(
                              title: AppStrings.themeTitle,
                              titleTrailing: themeDisplay,
                              titleTrailingColor: aquaColors.textSecondary,
                              iconLeading: SvgPicture.asset(
                                'assets/icons/palette.svg',
                                width: 24,
                                height: 24,
                                colorFilter: ColorFilter.mode(
                                  aquaColors.textSecondary,
                                  BlendMode.srcIn,
                                ),
                              ),
                              iconTrailing: AquaIcon.chevronRight(),
                              onTap: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => ThemeSelectionScreen(),
                                  ),
                                );
                              },
                              backgroundColor: aquaColors.surfacePrimary,
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
