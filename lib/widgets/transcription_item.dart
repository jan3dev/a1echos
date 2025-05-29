import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:ui_components/ui_components.dart';
import '../models/transcription.dart';
import 'package:intl/intl.dart';
import '../constants/app_constants.dart';
import 'package:skeletonizer/skeletonizer.dart';

class TranscriptionItem extends StatelessWidget {
  final Transcription transcription;
  final bool selectionMode;
  final bool isSelected;
  final bool isLivePreviewItem;
  final bool isLoadingWhisperResult;
  final bool isLoadingVoskResult;
  final bool isWhisperRecording;
  final VoidCallback onTap;
  final VoidCallback onLongPress;

  const TranscriptionItem({
    super.key,
    required this.transcription,
    this.selectionMode = false,
    this.isSelected = false,
    this.isLivePreviewItem = false,
    this.isLoadingWhisperResult = false,
    this.isLoadingVoskResult = false,
    this.isWhisperRecording = false,
    required this.onTap,
    required this.onLongPress,
  });

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final isOlderThanCurrentYear = transcription.timestamp.year < now.year;
    final dateFormat =
        isOlderThanCurrentYear
            ? DateFormat('MMM d, yyyy')
            : DateFormat('MMM d');
    final timeFormat = DateFormat('h:mm a');
    final colors = AquaColors.lightColors;

    Color backgroundColor = colors.surfacePrimary;
    if (selectionMode && isSelected) {
      backgroundColor = colors.surfaceSelected;
    }

    bool showSkeleton =
        isLoadingWhisperResult || isLoadingVoskResult || isWhisperRecording;
    bool enableInteractions = !isLivePreviewItem && !showSkeleton;
    bool showCopyIcon = !isLivePreviewItem && !selectionMode;
    bool showCheckbox = selectionMode && !isLivePreviewItem;
    bool disableCopyIcon = showSkeleton;

    return GestureDetector(
      onTap: enableInteractions ? onTap : null,
      onLongPress: enableInteractions ? onLongPress : null,
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
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text:
                              (showSkeleton ||
                                      !(isLivePreviewItem &&
                                          transcription.text.isEmpty))
                                  ? dateFormat.format(transcription.timestamp)
                                  : "",
                          style: AquaTypography.caption1Medium.copyWith(
                            color: colors.textSecondary,
                          ),
                        ),
                        const TextSpan(text: '  '),
                        TextSpan(
                          text:
                              (showSkeleton ||
                                      !(isLivePreviewItem &&
                                          transcription.text.isEmpty))
                                  ? timeFormat.format(transcription.timestamp)
                                  : "",
                          style: AquaTypography.caption1Medium.copyWith(
                            color: colors.textTertiary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (showCheckbox) _buildCheckbox(colors),
                if (showCopyIcon)
                  _buildCopyIcon(context, colors, disableCopyIcon),
              ],
            ),
            const SizedBox(height: 8),
            Skeletonizer(
              enabled: showSkeleton,
              child: Text(
                showSkeleton
                    ? 'Lorem ipsum dolor sit amet, consectetur adipi.'
                    : transcription.text,
                style: AquaTypography.body1.copyWith(
                  color: colors.textSecondary,
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
      return AquaCheckBox.small(value: true, onChanged: null);
    } else {
      return AquaCheckBox.small(value: false, onChanged: null);
    }
  }

  Widget _buildCopyIcon(
    BuildContext context,
    AquaColors colors,
    bool disabled,
  ) {
    return SizedBox(
      width: 18,
      height: 18,
      child: GestureDetector(
        onTap:
            disabled
                ? null
                : () => _copyToClipboard(context, transcription.text),
        behavior: HitTestBehavior.opaque,
        child: Opacity(
          opacity: disabled ? 0.5 : 1.0,
          child: Center(
            child: AquaIcon.copy(size: 18, color: colors.textSecondary),
          ),
        ),
      ),
    );
  }

  void _copyToClipboard(BuildContext context, String text) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(AppStrings.copiedToClipboard),
        duration: AppConstants.snackBarDurationShort,
      ),
    );
  }
}
