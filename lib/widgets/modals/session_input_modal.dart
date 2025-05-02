import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';

class SessionInputModal extends StatefulWidget {
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
    required String title,
    required String buttonText,
    String initialValue = '',
    required Function(String) onSubmit,
    VoidCallback? onCancel,
    bool showCancelButton = false,
    String cancelButtonText = 'Cancel',
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder:
          (dialogContext) => Padding(
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
  State<SessionInputModal> createState() => _SessionInputModalState();
}

class _SessionInputModalState extends State<SessionInputModal> {
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
    final aquaColors = AquaColors.lightColors;

    return Container(
      decoration: BoxDecoration(
        color: aquaColors.surfacePrimary,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(24),
          topRight: Radius.circular(24),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AquaTopAppBar(
            colors: aquaColors,
            title: widget.title,
            transparent: true,
            actions: [
              IconButton(
                icon: AquaIcon.close(),
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
            padding: const EdgeInsets.fromLTRB(16, 24, 16, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  decoration: BoxDecoration(
                    color: aquaColors.surfacePrimary,
                    borderRadius: BorderRadius.circular(8),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.04),
                        blurRadius: 16,
                        offset: const Offset(0, 0),
                      ),
                    ],
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 4,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          'Session Name',
                          style: AquaTypography.body1.copyWith(
                            color: aquaColors.textSecondary,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ),
                      TextField(
                        controller: _controller,
                        decoration: InputDecoration(
                          hintText: 'Enter session name',
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: const EdgeInsets.only(
                            top: 4,
                            bottom: 12,
                          ),
                        ),
                        style: AquaTypography.body1.copyWith(
                          color: aquaColors.textPrimary,
                        ),
                        autofocus: true,
                        textInputAction: TextInputAction.done,
                        onSubmitted: (_) => _handleSubmit(),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 32),
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
    if (text.isNotEmpty || widget.initialValue.isNotEmpty) {
      Navigator.pop(context);
      widget.onSubmit(text);
    }
  }
}
