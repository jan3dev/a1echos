import 'package:echos/utils/utils.dart';
import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/theme_provider.dart';
import '../providers/local_transcription_provider.dart';
import '../models/app_theme.dart';
import 'package:provider/provider.dart' as provider;

/// App bar component for the session screen that handles both normal and selection modes
class SessionAppBar extends ConsumerWidget implements PreferredSizeWidget {
  final String sessionName;
  final bool selectionMode;
  final bool editMode;
  final bool isIncognitoSession;
  final VoidCallback? onBackPressed;
  final VoidCallback? onTitlePressed;
  final VoidCallback? onCopyAllPressed;
  final VoidCallback? onLanguageFlagPressed;
  final VoidCallback? onSelectAllPressed;
  final VoidCallback? onDeleteSelectedPressed;
  final VoidCallback? onCancelEditPressed;
  final VoidCallback? onSaveEditPressed;

  const SessionAppBar({
    super.key,
    required this.sessionName,
    required this.selectionMode,
    this.editMode = false,
    required this.isIncognitoSession,
    this.onBackPressed,
    this.onTitlePressed,
    this.onCopyAllPressed,
    this.onLanguageFlagPressed,
    this.onSelectAllPressed,
    this.onDeleteSelectedPressed,
    this.onCancelEditPressed,
    this.onSaveEditPressed,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = selectedTheme.colors(context);

    if (editMode) {
      return AppBar(
        backgroundColor: colors.surfaceBackground,
        elevation: 0,
        leading: AquaIcon.close(
          color: colors.textPrimary,
          size: 24,
          onTap: onCancelEditPressed,
        ),
        title: AquaText.subtitleSemiBold(
          text: context.loc.edit,
          color: colors.textPrimary,
        ),
        centerTitle: true,
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: AquaIcon.check(
              color: colors.textPrimary,
              size: 24,
              onTap: onSaveEditPressed,
            ),
          ),
        ],
      );
    }

    return AquaTopAppBar(
      colors: colors,
      onBackPressed: onBackPressed,
      title: sessionName,
      actions: selectionMode
          ? [
              Padding(
                padding: const EdgeInsets.only(right: 16),
                child: AquaIcon.selectAll(
                  color: colors.textPrimary,
                  size: 24,
                  onTap: onSelectAllPressed,
                ),
              ),
              AquaIcon.trash(
                color: colors.textPrimary,
                size: 24,
                onTap: onDeleteSelectedPressed,
              ),
            ]
          : [
              // Language flag - only show for Whisper models
              provider.Consumer<LocalTranscriptionProvider>(
                builder: (context, transcriptionProvider, child) {
                  if (!transcriptionProvider.isLanguageSelectionAvailable) {
                    return const SizedBox.shrink();
                  }

                  return Padding(
                    padding: const EdgeInsets.only(right: 16),
                    child: GestureDetector(
                      onTap: onLanguageFlagPressed,
                      child: Text(
                        transcriptionProvider.selectedLanguage.flag,
                        style: const TextStyle(fontSize: 24),
                      ),
                    ),
                  );
                },
              ),
              AquaIcon.copyMultiple(
                color: colors.textPrimary,
                size: 24,
                onTap: onCopyAllPressed,
              ),
            ],
      onTitlePressed: !isIncognitoSession ? onTitlePressed : null,
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kAppBarHeight);
}
