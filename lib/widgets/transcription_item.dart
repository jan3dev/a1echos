import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:ui_components/ui_components.dart';
import '../models/transcription.dart';
import 'package:intl/intl.dart';
import '../constants/app_constants.dart';
import 'skeleton_loader.dart';

enum TranscriptionItemState { normal, longpressSelected, longpressUnselected }

class TranscriptionItem extends StatelessWidget {
  final Transcription transcription;
  final bool selectionMode;
  final bool isSelected;
  final bool isLivePreviewItem;
  final bool isLoadingWhisperResult;
  final bool isLoadingVoskResult;
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

    bool showSkeleton = isLoadingWhisperResult || isLoadingVoskResult;
    bool enableInteractions = !isLivePreviewItem && !showSkeleton;
    bool showCopyIcon = !isLivePreviewItem && !showSkeleton;
    bool showCheckbox = selectionMode && !isLivePreviewItem && !showSkeleton;

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
                  child: Text(
                    (showSkeleton ||
                            !(isLivePreviewItem && transcription.text.isEmpty))
                        ? dateFormat.format(transcription.timestamp)
                        : "",
                    style: AquaTypography.caption1Medium.copyWith(
                      color: colors.textTertiary,
                    ),
                  ),
                ),
                if (showCheckbox) _buildCheckbox(colors),
              ],
            ),
            const SizedBox(height: 8),
            if (showSkeleton)
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SkeletonLoader(height: 16),
                  SizedBox(height: 8),
                  SkeletonLoader(height: 16, width: 200),
                ],
              )
            else
              Text(
                transcription.text,
                style: AquaTypography.body1.copyWith(
                  color: colors.textSecondary,
                ),
              ),
            if (showCopyIcon)
              Align(
                alignment: Alignment.centerRight,
                child: SizedBox(
                  width: 18,
                  height: 18,
                  child: GestureDetector(
                    onTap: () => _copyToClipboard(context, transcription.text),
                    behavior: HitTestBehavior.opaque,
                    child: Center(
                      child: AquaIcon.copy(
                        size: 18,
                        color: colors.textTertiary,
                      ),
                    ),
                  ),
                ),
              )
            else if (!showSkeleton)
              const SizedBox(height: 18),
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
        content: Text(AppStrings.copiedToClipboard),
        duration: AppConstants.snackBarDurationShort,
      ),
    );
  }
}
