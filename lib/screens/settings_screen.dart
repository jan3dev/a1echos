import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ui_components/ui_components.dart';
import '../providers/local_transcription_provider.dart';
import '../models/model_type.dart';
import '../constants/app_constants.dart';

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
      extendBodyBehindAppBar: true,
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
                      const SizedBox(height: 80),
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
                          color: AquaColors.lightColors.surfacePrimary,
                          borderRadius: BorderRadius.circular(8),
                          boxShadow: [
                            BoxShadow(
                              color: aquaColors.surfacePrimary.withOpacity(
                                0.04,
                              ),
                              blurRadius: 16,
                            ),
                          ],
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: Column(
                          children: [
                            AquaListItem(
                              title: AppStrings.voskModelTitle,
                              subtitle: AppStrings.voskModelSubtitle,
                              iconLeading: AquaRadio<ModelType>(
                                value: ModelType.vosk,
                                groupValue: provider.selectedModelType,
                                onChanged:
                                    (value) => provider.changeModel(value),
                              ),
                              onTap: () => provider.changeModel(ModelType.vosk),
                              backgroundColor: aquaColors.surfacePrimary,
                            ),
                            Divider(
                              height: 1,
                              color: aquaColors.surfaceBorderSecondary,
                            ),
                            AquaListItem(
                              title: AppStrings.whisperModelTitle,
                              subtitle: AppStrings.whisperModelSubtitle,
                              iconLeading: AquaRadio<ModelType>(
                                value: ModelType.whisper,
                                groupValue: provider.selectedModelType,
                                onChanged:
                                    (value) => provider.changeModel(value),
                              ),
                              onTap:
                                  () => provider.changeModel(ModelType.whisper),
                              backgroundColor: aquaColors.surfacePrimary,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
