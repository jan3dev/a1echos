import 'package:echos/utils/utils.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ui_components/ui_components.dart';

import '../../constants/app_constants.dart';
import '../../providers/theme_provider.dart';
import '../../models/app_theme.dart';

class SessionInputModal extends ConsumerStatefulWidget {
  final String title;
  final String buttonText;
  final String initialValue;
  final Function(String) onSubmit;
  final VoidCallback? onCancel;
  final bool showCancelButton;
  final String cancelButtonText;

  /// A reusable modal for session creation or renaming
  ///
  /// [title] - The title displayed in the modal header
  /// [buttonText] - Text for the primary action button
  /// [initialValue] - Optional initial value for the text field (used when renaming)
  /// [onSubmit] - Callback function that receives the input text when submitted
  /// [onCancel] - Optional callback when cancel is pressed
  /// [showCancelButton] - Whether to show a cancel button
  /// [cancelButtonText] - Text for the cancel button
  const SessionInputModal({
    super.key,
    required this.title,
    required this.buttonText,
    this.initialValue = '',
    required this.onSubmit,
    this.onCancel,
    this.showCancelButton = false,
    this.cancelButtonText = 'Cancel',
  });

  /// Show the session input modal
  static Future<void> show(
    BuildContext context, {
    required WidgetRef ref,
    required String title,
    required String buttonText,
    String initialValue = '',
    required Function(String) onSubmit,
    VoidCallback? onCancel,
    bool showCancelButton = false,
    String cancelButtonText = 'Cancel',
  }) {
    final appTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = appTheme.colors(context);
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: colors.surfacePrimary.withOpacity(0),
      builder: (dialogContext) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(dialogContext).viewInsets.bottom,
        ),
        child: SessionInputModal(
          title: title,
          buttonText: buttonText,
          initialValue: initialValue,
          onSubmit: onSubmit,
          onCancel: onCancel,
          showCancelButton: showCancelButton,
          cancelButtonText: cancelButtonText,
        ),
      ),
    );
  }

  @override
  ConsumerState<SessionInputModal> createState() => _SessionInputModalState();
}

class _SessionInputModalState extends ConsumerState<SessionInputModal> {
  late TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialValue);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final appTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = appTheme.colors(context);

    return Container(
      decoration: BoxDecoration(
        color: colors.surfacePrimary,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(24),
          topRight: Radius.circular(24),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AquaTopAppBar(
            colors: colors,
            title: widget.title,
            transparent: true,
            actions: [
              IconButton(
                icon: AquaIcon.close(color: colors.textPrimary, size: 24),
                onPressed: () {
                  Navigator.pop(context);
                  if (widget.onCancel != null) {
                    widget.onCancel!();
                  }
                },
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 48, 16, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AquaTextField(
                      controller: _controller,
                      label: context.loc.sessionNameLabel,
                      maxLength: AppConstants.sessionNameMaxLength,
                      assistiveText: context.loc.sessionNameMaxLengthHelper,
                      transparentBorder: true,
                      showClearIcon: true,
                      onClear: () {
                        _controller.clear();
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 48),
                SizedBox(
                  width: double.infinity,
                  child: AquaButton.primary(
                    text: widget.buttonText,
                    onPressed: _handleSubmit,
                  ),
                ),
                if (widget.showCancelButton) ...[
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: AquaButton.secondary(
                      text: widget.cancelButtonText,
                      onPressed: () {
                        Navigator.pop(context);
                        if (widget.onCancel != null) {
                          widget.onCancel!();
                        }
                      },
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _handleSubmit() {
    final text = _controller.text.trim();
    if ((text.isNotEmpty || widget.initialValue.isNotEmpty) &&
        text.length <= AppConstants.sessionNameMaxLength) {
      Navigator.pop(context);
      widget.onSubmit(text);
    }
  }
}
