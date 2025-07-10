import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ui_components/ui_components.dart';
import 'dart:io';
import '../providers/local_transcription_provider.dart';
import '../models/model_type.dart';
import '../constants/app_constants.dart';
import '../providers/transcription_state_manager.dart';
import '../widgets/aqua_in_app_banner.dart';

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
          if (provider.state == TranscriptionState.loading) {
            return Center(child: AquaIndefinateProgressIndicator());
          }

          return Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        AppStrings.transcriptionModelTitle,
                        style: AquaTypography.body1SemiBold.copyWith(
                          color: aquaColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        AppStrings.transcriptionModelDescription,
                        style: AquaTypography.body1.copyWith(
                          color: aquaColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 16),
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
                          children: () {
                            // Determine current selection key
                            final String selectedKey;
                            if (provider.selectedModelType == ModelType.vosk) {
                              selectedKey = 'vosk';
                            } else {
                              selectedKey = provider.whisperRealtime
                                  ? 'whisper_rt'
                                  : 'whisper_file';
                            }

                            List<Widget> items = [];

                            // Helper to build AquaListItem
                            Widget buildItem({
                              required String key,
                              required String title,
                              required String subtitle,
                              required VoidCallback? onTap,
                            }) {
                              return AquaListItem(
                                title: title,
                                titleTrailing: subtitle,
                                titleTrailingColor: aquaColors.textSecondary,
                                iconTrailing: AquaRadio<String>(
                                  value: key,
                                  groupValue: selectedKey,
                                  onChanged: (_) => onTap?.call(),
                                ),
                                onTap: onTap,
                                backgroundColor: aquaColors.surfacePrimary,
                              );
                            }

                            // Helper to add divider between items
                            void addDivider() {
                              items.add(
                                Divider(
                                  height: 1,
                                  color: aquaColors.surfaceBorderPrimary,
                                ),
                              );
                            }

                            // Whisper File-based (available on both platforms)
                            items.add(
                              buildItem(
                                key: 'whisper_file',
                                title: AppStrings.whisperModelFileTitle,
                                subtitle: AppStrings.whisperModelSubtitle,
                                onTap: () async {
                                  if (provider.whisperRealtime) {
                                    await provider.setWhisperRealtime(false);
                                  }
                                  if (provider.selectedModelType !=
                                      ModelType.whisper) {
                                    await provider.changeModel(
                                      ModelType.whisper,
                                    );
                                  }
                                },
                              ),
                            );

                            // Platform-specific models
                            if (Platform.isIOS) {
                              // iOS: Add Whisper Real-time
                              addDivider();
                              items.add(
                                buildItem(
                                  key: 'whisper_rt',
                                  title: AppStrings.whisperModelRealtimeTitle,
                                  subtitle: AppStrings.whisperModelSubtitle,
                                  onTap: () async {
                                    if (!provider.whisperRealtime) {
                                      await provider.setWhisperRealtime(true);
                                    }
                                    if (provider.selectedModelType !=
                                        ModelType.whisper) {
                                      await provider.changeModel(
                                        ModelType.whisper,
                                      );
                                    }
                                  },
                                ),
                              );
                            } else if (Platform.isAndroid) {
                              // Android: Add Vosk
                              addDivider();
                              items.add(
                                buildItem(
                                  key: 'vosk',
                                  title: AppStrings.voskModelTitle,
                                  subtitle: AppStrings.voskModelSubtitle,
                                  onTap: () async {
                                    await provider.changeModel(
                                      ModelType.vosk,
                                    );
                                  },
                                ),
                              );
                            }

                            return items;
                          }(),
                        ),
                      ),
                      // Show initialization error for Whisper
                      if (provider.selectedModelType == ModelType.whisper &&
                          !provider.isInitializing &&
                          (provider.error != null ||
                              (provider.initializationStatus != null &&
                                  (provider.initializationStatus!.contains(
                                        'failed',
                                      ) ||
                                      provider.initializationStatus!.contains(
                                        'error',
                                      ) ||
                                      provider.initializationStatus!.contains(
                                        'timeout',
                                      ) ||
                                      provider.initializationStatus!.contains(
                                        'Failed',
                                      )))))
                        Container(
                          margin: const EdgeInsets.only(top: 16),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: aquaColors.surfacePrimary,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: aquaColors.textPrimary.withOpacity(0.3),
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(
                                    Icons.warning_rounded,
                                    size: 16,
                                    color: aquaColors.accentDanger,
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      AppStrings.whisperModelError,
                                      style: AquaTypography.body1SemiBold
                                          .copyWith(
                                            color: aquaColors.accentDanger,
                                          ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                provider.error ??
                                    provider.initializationStatus ??
                                    AppStrings.unknownErrorOccured,
                                style: AquaTypography.body2.copyWith(
                                  color: aquaColors.textSecondary,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                AppStrings.trySwitchingModelOrRestartingApp,
                                style: AquaTypography.body2.copyWith(
                                  color: aquaColors.textSecondary,
                                ),
                              ),
                              const SizedBox(height: 12),
                              GestureDetector(
                                onTap: () =>
                                    provider.changeModel(ModelType.whisper),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 8,
                                  ),
                                  decoration: BoxDecoration(
                                    color: aquaColors.surfaceBackground,
                                    borderRadius: BorderRadius.circular(4),
                                    border: Border.all(
                                      color: aquaColors.surfaceBorderPrimary,
                                    ),
                                  ),
                                  child: Text(
                                    AppStrings.retryInitialization,
                                    style: AquaTypography.body2SemiBold
                                        .copyWith(
                                          color: aquaColors.textPrimary,
                                        ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      const SizedBox(
                        height: 235,
                      ), // 211px banner + 24px spacing
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: const AquaInAppBanner(),
              ),
            ],
          );
        },
      ),
    );
  }
}
