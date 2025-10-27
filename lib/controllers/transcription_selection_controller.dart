import 'package:echos/utils/utils.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:haptic_feedback/haptic_feedback.dart';
import 'package:share_plus/share_plus.dart';
import 'package:ui_components/ui_components.dart';

import '../providers/local_transcription_provider.dart';
import '../providers/theme_provider.dart';
import '../services/share_service.dart';
import '../logger.dart';
import '../utils/platform_utils.dart';
import '../models/app_theme.dart';
import '../widgets/toast/confirmation_toast.dart';

/// Controller for managing transcription selection and bulk operations
class TranscriptionSelectionController with ChangeNotifier {
  final LocalTranscriptionProvider _transcriptionProvider;
  bool _selectionMode = false;
  final Set<String> _selectedTranscriptionIds = <String>{};

  TranscriptionSelectionController({
    required LocalTranscriptionProvider transcriptionProvider,
  }) : _transcriptionProvider = transcriptionProvider;

  bool get selectionMode => _selectionMode;
  Set<String> get selectedTranscriptionIds =>
      Set.from(_selectedTranscriptionIds);
  bool get hasSelectedItems => _selectedTranscriptionIds.isNotEmpty;
  int get selectedCount => _selectedTranscriptionIds.length;

  /// Toggles selection of a transcription
  void toggleTranscriptionSelection(String transcriptionId) {
    if (_selectedTranscriptionIds.contains(transcriptionId)) {
      _selectedTranscriptionIds.remove(transcriptionId);
      if (_selectedTranscriptionIds.isEmpty) {
        _selectionMode = false;
      }
    } else {
      _selectedTranscriptionIds.add(transcriptionId);
    }
    notifyListeners();
  }

  /// Handles long press on a transcription to enter/toggle selection mode
  void handleTranscriptionLongPress(String transcriptionId) async {
    if (!_selectionMode) {
      _selectionMode = true;
      _selectedTranscriptionIds.add(transcriptionId);
      final canVibrate = await Haptics.canVibrate();
      if (canVibrate) {
        Haptics.vibrate(HapticsType.heavy);
      }
    } else {
      toggleTranscriptionSelection(transcriptionId);
    }
    notifyListeners();
  }

  /// Selects all transcriptions in the current session
  void selectAllTranscriptions() {
    _selectedTranscriptionIds.clear();
    _selectedTranscriptionIds.addAll(
      _transcriptionProvider.sessionTranscriptions.map((t) => t.id),
    );
    notifyListeners();
  }

  /// Exits selection mode and clears all selections
  void exitSelectionMode() {
    _selectionMode = false;
    _selectedTranscriptionIds.clear();
    notifyListeners();
  }

  /// Deletes selected transcriptions with confirmation
  void deleteSelectedTranscriptions(BuildContext context, WidgetRef ref) {
    if (_selectedTranscriptionIds.isEmpty) return;

    ConfirmationToast.show(
      context: context,
      ref: ref,
      title: context.loc.sessionDeleteTranscriptionsTitle,
      message: context.loc.sessionDeleteTranscriptionsMessage(
        _selectedTranscriptionIds.length,
      ),
      confirmText: context.loc.delete,
      cancelText: context.loc.cancel,
      onConfirm: () async {
        Navigator.pop(context);

        // Wait for dialog to fully dismiss before showing tooltip
        await Future.delayed(const Duration(milliseconds: 300));

        try {
          final deletedCount = _selectedTranscriptionIds.length;
          await _transcriptionProvider.deleteTranscriptions(
            _selectedTranscriptionIds,
          );
          exitSelectionMode();

          if (context.mounted) {
            final colors = ref
                .read(prefsProvider)
                .selectedTheme
                .colors(context);
            AquaTooltip.show(
              context,
              message: context.loc.sessionTranscriptionsDeleted(deletedCount),
              colors: colors,
            );
          }
        } catch (e, st) {
          if (context.mounted) {
            logger.error(
              e,
              stackTrace: st,
              flag: FeatureFlag.ui,
              message: 'Failed to delete selected transcriptions',
            );
            final colors = ref
                .read(prefsProvider)
                .selectedTheme
                .colors(context);
            AquaTooltip.show(
              context,
              message: context.loc.sessionErrorDeletingTranscriptions(
                e.toString(),
                'transcriptions',
              ),
              variant: AquaTooltipVariant.error,
              colors: colors,
            );
          }
        }
      },
    );
  }

  /// Copies all transcriptions to clipboard
  Future<void> copyAllTranscriptions(
    BuildContext context,
    WidgetRef ref,
  ) async {
    final transcriptions = _transcriptionProvider.sessionTranscriptions;

    if (transcriptions.isEmpty) {
      final colors = ref.read(prefsProvider).selectedTheme.colors(context);
      AquaTooltip.show(
        context,
        message: context.loc.noTranscriptionsToCopy,
        variant: AquaTooltipVariant.warning,
        colors: colors,
      );
      return;
    }

    final text = transcriptions.map((t) => t.text).join('\n\n');

    try {
      await Clipboard.setData(ClipboardData(text: text));
      if (context.mounted) {
        final shouldShow = await PlatformUtils.shouldShowClipboardTooltip();
        if (shouldShow) {
          if (context.mounted) {
            final colors = ref
                .read(prefsProvider)
                .selectedTheme
                .colors(context);
            AquaTooltip.show(
              context,
              message: context.loc.allTranscriptionsCopied,
              colors: colors,
            );
          }
        }
      }
    } catch (e, st) {
      if (context.mounted) {
        logger.error(
          e,
          stackTrace: st,
          flag: FeatureFlag.ui,
          message: 'Failed to copy all transcriptions to clipboard',
        );
        final colors = ref.read(prefsProvider).selectedTheme.colors(context);
        AquaTooltip.show(
          context,
          message: context.loc.copyFailed(e.toString()),
          variant: AquaTooltipVariant.error,
          colors: colors,
        );
      }
    }
  }

  /// Checks if a transcription is selected
  bool isTranscriptionSelected(String transcriptionId) {
    return _selectedTranscriptionIds.contains(transcriptionId);
  }

  /// Shares selected transcriptions using the native share dialog
  Future<void> shareSelectedTranscriptions(
    BuildContext context,
    WidgetRef ref,
  ) async {
    if (_selectedTranscriptionIds.isEmpty) return;

    final selectedTranscriptions = _transcriptionProvider.sessionTranscriptions
        .where((t) => _selectedTranscriptionIds.contains(t.id))
        .toList();

    if (selectedTranscriptions.isEmpty) {
      final colors = ref.read(prefsProvider).selectedTheme.colors(context);
      AquaTooltip.show(
        context,
        message: context.loc.noTranscriptionsSelectedToShare,
        variant: AquaTooltipVariant.warning,
        colors: colors,
      );
      return;
    }

    try {
      // Calculate share position origin for iOS (centered at bottom of screen)
      final box = context.findRenderObject() as RenderBox?;
      final sharePositionOrigin = box != null
          ? Rect.fromCenter(
              center: Offset(box.size.width / 2, box.size.height - 100),
              width: 10,
              height: 10,
            )
          : null;

      final result = await ShareService.shareTranscriptions(
        selectedTranscriptions,
        sharePositionOrigin: sharePositionOrigin,
      );

      if (result.status == ShareResultStatus.success) {
        exitSelectionMode();
      }
    } catch (e, st) {
      if (context.mounted) {
        logger.error(
          e,
          stackTrace: st,
          flag: FeatureFlag.ui,
          message: 'Failed to share selected transcriptions',
        );
        final colors = ref.read(prefsProvider).selectedTheme.colors(context);
        AquaTooltip.show(
          context,
          message: context.loc.shareFailed(e.toString()),
          variant: AquaTooltipVariant.error,
          colors: colors,
        );
      }
    }
  }
}
