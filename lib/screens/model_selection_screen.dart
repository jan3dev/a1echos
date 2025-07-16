import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ui_components/ui_components.dart';
import '../providers/local_transcription_provider.dart';
import '../constants/app_constants.dart';
import '../models/model_type.dart';

class ModelSelectionScreen extends StatelessWidget {
  const ModelSelectionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final aquaColors = AquaColors.lightColors;
    return Scaffold(
      backgroundColor: aquaColors.surfaceBackground,
      appBar: AquaTopAppBar(colors: aquaColors, title: AppStrings.modelTitle),
      body: Consumer<LocalTranscriptionProvider>(
        builder: (context, provider, child) {
          final String selectedKey =
              provider.selectedModelType == ModelType.vosk
              ? 'vosk'
              : (provider.whisperRealtime ? 'whisper_rt' : 'whisper_file');

          List<Widget> items = [];

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

          void addDivider() {
            items.add(
              Divider(height: 1, color: aquaColors.surfaceBorderPrimary),
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
                if (provider.selectedModelType != ModelType.whisper) {
                  await provider.changeModel(ModelType.whisper);
                }
                Navigator.of(context).pop();
              },
            ),
          );

          // Platform-specific models
          if (Platform.isIOS) {
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
                  if (provider.selectedModelType != ModelType.whisper) {
                    await provider.changeModel(ModelType.whisper);
                  }
                  Navigator.of(context).pop();
                },
              ),
            );
          } else if (Platform.isAndroid) {
            addDivider();
            items.add(
              buildItem(
                key: 'vosk',
                title: AppStrings.voskModelTitle,
                subtitle: AppStrings.voskModelSubtitle,
                onTap: () async {
                  await provider.changeModel(ModelType.vosk);
                  Navigator.of(context).pop();
                },
              ),
            );
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  AppStrings.modelDescription,
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
                        color: aquaColors.surfaceInverse.withOpacity(0.04),
                        blurRadius: 16,
                        offset: const Offset(0, 0),
                      ),
                    ],
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Column(children: items),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
