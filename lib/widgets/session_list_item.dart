import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';
import 'package:provider/provider.dart' as provider;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/session.dart';
import '../providers/local_transcription_provider.dart';
import 'menus/session_more_menu.dart';
import '../providers/theme_provider.dart';
import '../models/app_theme.dart';

class SessionListItem extends ConsumerWidget {
  final Session session;
  final VoidCallback onTap;
  final VoidCallback onLongPress;
  final bool selectionMode;
  final bool isSelected;
  final BuildContext stableContext;

  const SessionListItem({
    super.key,
    required this.session,
    required this.onTap,
    required this.onLongPress,
    this.selectionMode = false,
    this.isSelected = false,
    required this.stableContext,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = selectedTheme.colors(context);
    final transcriptions = provider.Provider.of<LocalTranscriptionProvider>(
      context,
    ).allTranscriptions;
    final count = transcriptions.where((t) => t.sessionId == session.id).length;
    final String subtitle = count == 1
        ? '1 Transcription'
        : '$count Transcriptions';

    return GestureDetector(
      onLongPress: onLongPress,
      child: AquaListItem(
        title: session.name,
        subtitle: subtitle,
        iconLeading: null,
        iconTrailing: selectionMode
            ? _buildCheckbox()
            : SessionMoreMenu(
                session: session,
                listItemContext: context,
                stableContext: stableContext,
              ),
        backgroundColor: colors.surfacePrimary,
        titleColor: colors.textPrimary,
        subtitleColor: colors.textSecondary,
        onTap: onTap,
      ),
    );
  }

  Widget _buildCheckbox() {
    return AquaCheckBox.small(value: isSelected, onChanged: (_) {});
  }
}
