import 'package:echos/utils/utils.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../providers/local_transcription_provider.dart';
import '../services/share_service.dart';
import '../logger.dart';
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
  void handleTranscriptionLongPress(String transcriptionId) {
    if (!_selectionMode) {
      _selectionMode = true;
      _selectedTranscriptionIds.add(transcriptionId);
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

        try {
          final deletedCount = _selectedTranscriptionIds.length;
          await _transcriptionProvider.deleteTranscriptions(
            _selectedTranscriptionIds,
          );
          exitSelectionMode();

          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  context.loc.sessionTranscriptionsDeleted(deletedCount),
                ),
              ),
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
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  context.loc.sessionErrorDeletingTranscriptions(
                    e.toString(),
                    'transcriptions',
                  ),
                ),
              ),
            );
          }
        }
      },
    );
  }

  /// Copies all transcriptions to clipboard
  Future<void> copyAllTranscriptions(BuildContext context) async {
    final transcriptions = _transcriptionProvider.sessionTranscriptions;

    if (transcriptions.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.loc.noTranscriptionsToCopy)),
      );
      return;
    }

    final text = transcriptions.map((t) => t.text).join('\n\n');

    try {
      await Clipboard.setData(ClipboardData(text: text));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.loc.allTranscriptionsCopied)),
        );
      }
    } catch (e, st) {
      if (context.mounted) {
        logger.error(
          e,
          stackTrace: st,
          flag: FeatureFlag.ui,
          message: 'Failed to copy all transcriptions to clipboard',
        );
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.loc.copyFailed(e.toString()))),
        );
      }
    }
  }

  /// Checks if a transcription is selected
  bool isTranscriptionSelected(String transcriptionId) {
    return _selectedTranscriptionIds.contains(transcriptionId);
  }

  /// Shares selected transcriptions using the native share dialog
  Future<void> shareSelectedTranscriptions(BuildContext context) async {
    if (_selectedTranscriptionIds.isEmpty) return;

    final selectedTranscriptions = _transcriptionProvider.sessionTranscriptions
        .where((t) => _selectedTranscriptionIds.contains(t.id))
        .toList();

    if (selectedTranscriptions.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.loc.noTranscriptionsSelectedToShare)),
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.loc.shareFailed(e.toString()))),
        );
      }
    }
  }
}
