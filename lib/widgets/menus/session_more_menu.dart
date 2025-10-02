import 'package:echos/widgets/toast/confirmation_toast.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ui_components/ui_components.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart' as provider;
import 'package:echos/utils/utils.dart';
import '../../models/session.dart';
import '../../providers/theme_provider.dart';
import '../../models/app_theme.dart';
import '../modals/session_input_modal.dart';
import '../../providers/session_provider.dart';

class SessionMoreMenu extends ConsumerWidget {
  final Session session;
  final BuildContext listItemContext;

  const SessionMoreMenu({
    super.key,
    required this.session,
    required this.listItemContext,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = selectedTheme.colors(context);

    return AquaIcon.more(
      color: colors.textPrimary,
      onTap: () => _showMoreMenu(context, ref),
    );
  }

  void _showMoreMenu(BuildContext context, WidgetRef ref) {
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = selectedTheme.colors(context);

    final RenderBox? listItemBox =
        listItemContext.findRenderObject() as RenderBox?;
    final RenderBox overlay =
        Navigator.of(context).overlay!.context.findRenderObject() as RenderBox;

    if (listItemBox == null) return;

    final Offset listItemPosition = listItemBox.localToGlobal(
      Offset.zero,
      ancestor: overlay,
    );
    final Size listItemSize = listItemBox.size;

    const double offsetY = -16.0;
    final RelativeRect position = RelativeRect.fromRect(
      Rect.fromLTWH(
        listItemPosition.dx + listItemSize.width - 240,
        listItemPosition.dy + listItemSize.height + offsetY,
        240,
        0,
      ),
      Offset.zero & overlay.size,
    );

    showMenu<String>(
      context: context,
      position: position,
      items: [
        PopupMenuItem<String>(
          value: 'rename',
          padding: EdgeInsets.zero,
          child: AquaListItem(
            iconLeading: AquaIcon.edit(color: colors.textPrimary),
            title: context.loc.sessionRenameTitle,
            iconTrailing: AquaIcon.chevronRight(
              size: 18,
              color: colors.textSecondary,
            ),
            backgroundColor: colors.surfacePrimary,
            titleColor: colors.textPrimary,
            onTap: null,
          ),
        ),
        PopupMenuItem<String>(
          value: 'delete',
          padding: EdgeInsets.zero,
          child: AquaListItem(
            iconLeading: AquaIcon.trash(color: colors.textPrimary),
            title: context.loc.delete,
            iconTrailing: AquaIcon.chevronRight(
              size: 18,
              color: colors.textSecondary,
            ),
            backgroundColor: colors.surfacePrimary,
            titleColor: colors.textPrimary,
            onTap: null,
          ),
        ),
        PopupMenuItem<String>(
          enabled: false,
          padding: const EdgeInsets.only(
            left: 16,
            right: 16,
            top: 20,
            bottom: 8,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Modified: ${formatSessionSubtitle(now: DateTime.now(), created: session.timestamp, lastModified: session.lastModified, modifiedPrefix: context.loc.modifiedPrefix)}',
                style: AquaTypography.caption1Medium.copyWith(
                  color: colors.textTertiary,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                '${context.loc.createdPrefix}: ${DateFormat('MMM d, yyyy').format(session.timestamp)}',
                style: AquaTypography.caption1Medium.copyWith(
                  color: colors.textTertiary,
                ),
              ),
            ],
          ),
        ),
      ],
      color: colors.surfacePrimary,
      elevation: 8,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    ).then((String? value) {
      if (!context.mounted) return;

      if (value == 'rename') {
        SessionInputModal.show(
          context,
          ref: ref,
          title: context.loc.sessionRenameTitle,
          buttonText: context.loc.save,
          initialValue: session.name,
          onSubmit: (name) {
            final sessionProvider = provider.Provider.of<SessionProvider>(
              context,
              listen: false,
            );
            sessionProvider.renameSession(session.id, name);
          },
        );
      } else if (value == 'delete') {
        ConfirmationToast.show(
          context: context,
          ref: ref,
          title: context.loc.homeDeleteSelectedSessionsTitle,
          message: context.loc.homeDeleteSelectedSessionsMessage(1),
          confirmText: context.loc.delete,
          cancelText: context.loc.cancel,
          onConfirm: () {
            Navigator.pop(context);
            final sessionProvider = provider.Provider.of<SessionProvider>(
              context,
              listen: false,
            );
            sessionProvider.deleteSession(session.id);
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(context.loc.homeSessionsDeleted(1))),
            );
          },
        );
      }
    });
  }
}
