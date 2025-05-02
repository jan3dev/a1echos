import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:ui_components/ui_components.dart';
import '../models/transcription.dart';
import 'package:intl/intl.dart';
import '../constants/app_constants.dart';

enum TranscriptionItemState { normal, longpressSelected, longpressUnselected }

class TranscriptionItem extends StatelessWidget {
  final Transcription transcription;
  final bool selectionMode;
  final bool isSelected;
  final VoidCallback onTap;
  final VoidCallback onLongPress;

  const TranscriptionItem({
    super.key,
    required this.transcription,
    this.selectionMode = false,
    this.isSelected = false,
    required this.onTap,
    required this.onLongPress,
  });

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('MMM d, h:mm a');
    final colors = AquaColors.lightColors;

    Color backgroundColor = colors.surfacePrimary;
    if (selectionMode && isSelected) {
      backgroundColor = colors.surfaceSelected;
    }

    return GestureDetector(
      onTap: onTap,
      onLongPress: onLongPress,
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: backgroundColor,
          borderRadius: BorderRadius.circular(8),
          boxShadow: [
            BoxShadow(
              color: colors.surfacePrimary.withOpacity(0.04),
              blurRadius: 16,
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    dateFormat.format(transcription.timestamp),
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: colors.textTertiary,
                      letterSpacing: -0.12,
                    ),
                  ),
                ),

                if (selectionMode) _buildCheckbox(colors),
              ],
            ),

            const SizedBox(height: 8),

            Text(
              transcription.text,
              style: AquaTypography.body1.copyWith(color: colors.textSecondary),
            ),

            Align(
              alignment: Alignment.centerRight,
              child: SizedBox(
                width: 18,
                height: 18,
                child: GestureDetector(
                  onTap: () => _copyToClipboard(context, transcription.text),
                  behavior: HitTestBehavior.opaque,
                  child: Center(
                    child: AquaIcon.copy(size: 18, color: colors.textTertiary),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCheckbox(AquaColors colors) {
    if (isSelected) {
      return AquaCheckBox.small(value: true, onChanged: (_) {});
    } else {
      return AquaCheckBox.small(value: false, onChanged: (_) {});
    }
  }

  void _copyToClipboard(BuildContext context, String text) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Copied to clipboard'),
        duration: AppConstants.snackBarDurationShort,
      ),
    );
  }
}
