import 'dart:io';
import 'package:echos/utils/utils.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider;
import 'package:ui_components/ui_components.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/local_transcription_provider.dart';
import '../models/model_type.dart';
import '../providers/theme_provider.dart';
import '../models/app_theme.dart';

class ModelSelectionScreen extends ConsumerWidget {
  const ModelSelectionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = selectedTheme.colors(context);
    return Scaffold(
      backgroundColor: colors.surfaceBackground,
      appBar: AquaTopAppBar(colors: colors, title: context.loc.modelTitle),
      body: provider.Consumer<LocalTranscriptionProvider>(
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
              titleTrailingColor: colors.textSecondary,
              iconTrailing: AquaRadio<String>(
                value: key,
                groupValue: selectedKey,
                onChanged: (_) => onTap?.call(),
              ),
              onTap: onTap,
              backgroundColor: colors.surfacePrimary,
            );
          }

          void addDivider() {
            items.add(Divider(height: 1, color: colors.surfaceBorderPrimary));
          }

          // Whisper File-based (available on both platforms)
          items.add(
            buildItem(
              key: 'whisper_file',
              title: context.loc.whisperModelFileTitle,
              subtitle: context.loc.whisperModelSubtitle,
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
                title: context.loc.whisperModelRealtimeTitle,
                subtitle: context.loc.whisperModelSubtitle,
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
                title: context.loc.voskModelTitle,
                subtitle: context.loc.voskModelSubtitle,
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
                  context.loc.modelDescription,
                  style: AquaTypography.body1.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: 16),
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
