import 'package:echos/utils/utils.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider;
import 'package:ui_components/ui_components.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/local_transcription_provider.dart';
import '../models/spoken_language.dart';
import '../providers/theme_provider.dart';
import '../models/app_theme.dart';

class SpokenLanguageSelectionScreen extends ConsumerWidget {
  const SpokenLanguageSelectionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = selectedTheme.colors(context);
    
    return Scaffold(
      backgroundColor: colors.surfaceBackground,
      appBar: AquaTopAppBar(
        colors: colors, 
        title: context.loc.spokenLanguageTitle,
      ),
      body: SafeArea(
        child: provider.Consumer<LocalTranscriptionProvider>(
          builder: (context, transcriptionProvider, child) {
            final selectedLanguage = transcriptionProvider.selectedLanguage;
            
            List<Widget> items = [];
            
            Widget buildLanguageItem(SpokenLanguage language) {
              return AquaListItem(
                title: language.getName(context),
                titleTrailing: language.code.toUpperCase(),
                titleTrailingColor: colors.textSecondary,
                iconLeading: Text(
                  language.flag,
                  style: const TextStyle(fontSize: 24),
                ),
                iconTrailing: AquaRadio<String>(
                  value: language.code,
                  groupValue: selectedLanguage.code,
                  onChanged: (_) async {
                    await transcriptionProvider.setSelectedLanguage(language);
                    if (context.mounted) {
                      Navigator.of(context).pop();
                    }
                  },
                ),
                onTap: () async {
                  await transcriptionProvider.setSelectedLanguage(language);
                  if (context.mounted) {
                    Navigator.of(context).pop();
                  }
                },
                backgroundColor: colors.surfacePrimary,
              );
            }
            
            void addDivider() {
              items.add(Divider(height: 1, color: colors.surfaceBorderPrimary));
            }
            
            // Add all supported languages
            for (int i = 0; i < SupportedLanguages.all.length; i++) {
              if (i > 0) {
                addDivider();
              }
              items.add(buildLanguageItem(SupportedLanguages.all[i]));
            }
            
            return SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    context.loc.spokenLanguageDescription,
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
      ),
    );
  }
}
