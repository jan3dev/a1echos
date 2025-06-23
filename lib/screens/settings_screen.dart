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
                          children: [
                            AquaListItem(
                              title: AppStrings.whisperModelTitle,
                              titleTrailing: AppStrings.whisperModelSubtitle,
                              titleTrailingColor: aquaColors.textSecondary,
                              iconTrailing: AquaRadio<ModelType>(
                                value: ModelType.whisper,
                                groupValue: provider.selectedModelType,
                                onChanged:
                                    (value) => provider.changeModel(value),
                              ),
                              onTap:
                                  () => provider.changeModel(ModelType.whisper),
                              backgroundColor: aquaColors.surfacePrimary,
                            ),
                            Divider(
                              height: 1,
                              color: aquaColors.surfaceBorderPrimary,
                            ),
                            AquaListItem(
                              title: AppStrings.voskModelTitle,
                              titleTrailing:
                                  Platform.isAndroid
                                      ? AppStrings.voskModelSubtitle
                                      : "Not available on iOS",
                              titleTrailingColor:
                                  Platform.isAndroid
                                      ? aquaColors.textSecondary
                                      : aquaColors.textSecondary.withOpacity(
                                        0.5,
                                      ),
                              iconTrailing: AquaRadio<ModelType>(
                                value: ModelType.vosk,
                                groupValue: provider.selectedModelType,
                                onChanged:
                                    Platform.isAndroid
                                        ? (value) => provider.changeModel(value)
                                        : null, // Disabled on iOS
                              ),
                              onTap:
                                  Platform.isAndroid
                                      ? () =>
                                          provider.changeModel(ModelType.vosk)
                                      : null, // Disabled on iOS
                              backgroundColor:
                                  Platform.isAndroid
                                      ? aquaColors.surfacePrimary
                                      : aquaColors.surfacePrimary.withOpacity(
                                        0.5,
                                      ),
                            ),
                          ],
                        ),
                      ),
                      // Show initialization status for Whisper
                      if (provider.selectedModelType == ModelType.whisper &&
                          (provider.isInitializing ||
                              provider.isDownloadingModel))
                        Container(
                          margin: const EdgeInsets.only(top: 16),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: aquaColors.surfacePrimary,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: aquaColors.surfaceBorderPrimary,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      valueColor: AlwaysStoppedAnimation<Color>(
                                        aquaColors.textPrimary,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      provider.isDownloadingModel
                                          ? 'Downloading Whisper model...'
                                          : 'Initializing Whisper...',
                                      style: AquaTypography.body1SemiBold
                                          .copyWith(
                                            color: aquaColors.textPrimary,
                                          ),
                                    ),
                                  ),
                                ],
                              ),
                              if (provider.initializationStatus != null) ...[
                                const SizedBox(height: 8),
                                Text(
                                  provider.initializationStatus!,
                                  style: AquaTypography.body2.copyWith(
                                    color: aquaColors.textSecondary,
                                  ),
                                ),
                              ],
                              const SizedBox(height: 8),
                              Text(
                                provider.isDownloadingModel
                                    ? 'This may take several minutes on first use. The model is being downloaded to your device.'
                                    : 'Please wait while the model initializes...',
                                style: AquaTypography.body2.copyWith(
                                  color: aquaColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      // Show initialization error for Whisper
                      if (provider.selectedModelType == ModelType.whisper &&
                          !provider.isInitializing &&
                          !provider.isDownloadingModel &&
                          (provider.error != null ||
                           (provider.initializationStatus != null &&
                            (provider.initializationStatus!.contains('failed') ||
                             provider.initializationStatus!.contains('error') ||
                             provider.initializationStatus!.contains('timeout') ||
                             provider.initializationStatus!.contains('Failed')))))
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
                                      'Whisper Model Error',
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
                                provider.error ?? provider.initializationStatus ?? 'Unknown error occurred',
                                style: AquaTypography.body2.copyWith(
                                  color: aquaColors.textSecondary,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Try switching to a different model or restarting the app.',
                                style: AquaTypography.body2.copyWith(
                                  color: aquaColors.textSecondary,
                                ),
                              ),
                              const SizedBox(height: 12),
                              GestureDetector(
                                onTap:
                                    () =>
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
                                    'Retry Initialization',
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
