import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../providers/local_transcription_provider.dart';
import '../widgets/modals/confirmation_modal.dart';
import '../constants/app_constants.dart';

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
  void deleteSelectedTranscriptions(BuildContext context) {
    if (_selectedTranscriptionIds.isEmpty) return;

    ConfirmationModal.show(
      context: context,
      title: AppStrings.sessionDeleteTranscriptionsTitle,
      message: AppStrings.sessionDeleteTranscriptionsMessage
          .replaceAll('{count}', _selectedTranscriptionIds.length.toString())
          .replaceAll(
            '{transcriptions}',
            _selectedTranscriptionIds.length == 1
                ? 'transcription'
                : 'transcriptions',
          ),
      confirmText: AppStrings.sessionDeleteTranscriptionsButton,
      cancelText: AppStrings.cancel,
      onConfirm: () async {
        Navigator.pop(context);

        try {
          await _transcriptionProvider.deleteTranscriptions(
            _selectedTranscriptionIds,
          );
          exitSelectionMode();

          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(AppStrings.sessionTranscriptionsDeleted)),
            );
          }
        } catch (e) {
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  AppStrings.sessionErrorDeletingTranscriptions.replaceAll(
                    '{error}',
                    e.toString(),
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
        const SnackBar(content: Text(AppStrings.noTranscriptionsToCopy)),
      );
      return;
    }

    final text = transcriptions.map((t) => t.text).join('\n\n');

    try {
      await Clipboard.setData(ClipboardData(text: text));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text(AppStrings.allTranscriptionsCopied)),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to copy: ${e.toString()}')),
        );
      }
    }
  }

  /// Checks if a transcription is selected
  bool isTranscriptionSelected(String transcriptionId) {
    return _selectedTranscriptionIds.contains(transcriptionId);
  }
}
