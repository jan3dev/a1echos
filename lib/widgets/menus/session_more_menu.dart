import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ui_components/ui_components.dart';
import '../../models/session.dart';
import '../../constants/app_constants.dart';
import '../../providers/session_provider.dart';
import '../modals/confirmation_modal.dart';
import '../modals/session_input_modal.dart';

class SessionMoreMenu extends StatelessWidget {
  final Session session;
  final BuildContext listItemContext;

  const SessionMoreMenu({
    super.key,
    required this.session,
    required this.listItemContext,
  });

  @override
  Widget build(BuildContext context) {
    return AquaIcon.more(onTap: () => _showMoreMenu(context));
  }

  void _showMoreMenu(BuildContext context) {
    final colors = AquaColors.lightColors;

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

    const double estimatedMenuHeight = 136;
    final RelativeRect position = RelativeRect.fromRect(
      Rect.fromLTWH(
        listItemPosition.dx + listItemSize.width - 240,
        listItemPosition.dy +
            (listItemSize.height / 2) -
            (estimatedMenuHeight / 2),
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
            iconLeading: AquaIcon.edit(),
            title: AppStrings.sessionRenameTitle,
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
            iconLeading: AquaIcon.trash(),
            title: AppStrings.delete,
            iconTrailing: AquaIcon.chevronRight(
              size: 18,
              color: colors.textSecondary,
            ),
            backgroundColor: colors.surfacePrimary,
            titleColor: colors.textPrimary,
            onTap: null,
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
          title: AppStrings.sessionRenameTitle,
          buttonText: AppStrings.save,
          initialValue: session.name,
          onSubmit: (name) {
            final provider = Provider.of<SessionProvider>(
              context,
              listen: false,
            );
            provider.renameSession(session.id, name);
          },
        );
      } else if (value == 'delete') {
        ConfirmationModal.show(
          context: context,
          title: AppStrings.homeDeleteSelectedSessionsTitle,
          message: AppStrings.homeDeleteSelectedSessionsMessage
              .replaceAll('{count}', 'this')
              .replaceAll('{sessions}', 'session'),
          confirmText: AppStrings.homeDeleteSessionsButton,
          onConfirm: () {
            Navigator.pop(context);
            final provider = Provider.of<SessionProvider>(
              context,
              listen: false,
            );
            provider.deleteSession(session.id);
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(AppStrings.homeSessionsDeleted)),
            );
          },
        );
      }
    });
  }
}
