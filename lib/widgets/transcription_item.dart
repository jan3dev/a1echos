import 'package:echos/utils/utils.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:ui_components/ui_components.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:skeletonizer/skeletonizer.dart';
import 'package:provider/provider.dart' as provider;
import '../models/transcription.dart';
import '../constants/app_constants.dart';
import '../providers/local_transcription_provider.dart';
import '../providers/theme_provider.dart';
import '../models/app_theme.dart';

class TranscriptionItem extends ConsumerStatefulWidget {
  final Transcription transcription;
  final bool selectionMode;
  final bool isSelected;
  final bool isLivePreviewItem;
  final bool isLoadingWhisperResult;
  final bool isLoadingVoskResult;
  final bool isWhisperRecording;
  final VoidCallback onTap;
  final VoidCallback onLongPress;
  final bool isEditing;
  final bool isAnyEditing;
  final VoidCallback onStartEdit;
  final VoidCallback onEndEdit;

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
    required this.isEditing,
    required this.isAnyEditing,
    required this.onStartEdit,
    required this.onEndEdit,
  });

  @override
  ConsumerState<TranscriptionItem> createState() => TranscriptionItemState();
}

class TranscriptionItemState extends ConsumerState<TranscriptionItem> {
  late TextEditingController _controller;
  bool _cancelled = false;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.transcription.text);
  }

  @override
  void didUpdateWidget(covariant TranscriptionItem oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.transcription.text != widget.transcription.text) {
      _controller.text = widget.transcription.text;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _saveEdit() async {
    if (_cancelled) {
      _cancelled = false;
      widget.onEndEdit();
      return;
    }
    final newText = _controller.text.trim();
    if (newText.isEmpty || newText == widget.transcription.text) {
      widget.onEndEdit();
      _controller.text = widget.transcription.text;
      return;
    }
    final updated = Transcription(
      id: widget.transcription.id,
      sessionId: widget.transcription.sessionId,
      text: newText,
      timestamp: widget.transcription.timestamp,
      audioPath: widget.transcription.audioPath,
    );
    provider.Provider.of<LocalTranscriptionProvider>(
      context,
      listen: false,
    ).updateTranscription(updated);
    widget.onEndEdit();
  }

  void cancelEdit() {
    _cancelled = true;
    _controller.text = widget.transcription.text;
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final isOlderThanCurrentYear =
        widget.transcription.timestamp.year < now.year;
    final dateFormat = isOlderThanCurrentYear
        ? DateFormat('MMM d, yyyy')
        : DateFormat('MMM d');
    final timeFormat = DateFormat('h:mm a');
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = selectedTheme.colors(context);

    Color backgroundColor = colors.surfacePrimary;
    if (widget.selectionMode && widget.isSelected) {
      backgroundColor = colors.surfaceSelected;
    }

    bool showSkeleton =
        widget.isLoadingWhisperResult ||
        widget.isLoadingVoskResult ||
        widget.isWhisperRecording;
    bool enableInteractions = !widget.isLivePreviewItem && !showSkeleton;
    bool showCopyIcon = !widget.isLivePreviewItem && !widget.selectionMode;
    bool showEditIcon = !widget.isLivePreviewItem && !widget.selectionMode;
    bool showCheckbox = widget.selectionMode && !widget.isLivePreviewItem;
    bool disableIcons =
        showSkeleton || (widget.isAnyEditing && !widget.isEditing);

    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onTap: () {
        if (!widget.isEditing && enableInteractions) {
          widget.onTap();
        }
      },
      onLongPress: enableInteractions ? widget.onLongPress : null,
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: backgroundColor,
          borderRadius: BorderRadius.circular(8),
          border: widget.isEditing
              ? Border.all(color: colors.accentBrand, width: 1)
              : null,
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
                                  !(widget.isLivePreviewItem &&
                                      widget.transcription.text.isEmpty))
                              ? dateFormat.format(
                                  widget.transcription.timestamp,
                                )
                              : "",
                          style: AquaTypography.caption1Medium.copyWith(
                            color: colors.textSecondary,
                          ),
                        ),
                        const TextSpan(text: '  '),
                        TextSpan(
                          text:
                              (showSkeleton ||
                                  !(widget.isLivePreviewItem &&
                                      widget.transcription.text.isEmpty))
                              ? timeFormat.format(
                                  widget.transcription.timestamp,
                                )
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
                if (showEditIcon) _buildEditIcon(context, colors, disableIcons),
                if (showEditIcon && showCopyIcon) const SizedBox(width: 16),
                if (showCopyIcon) _buildCopyIcon(context, colors, disableIcons),
              ],
            ),
            const SizedBox(height: 8),
            if (widget.isEditing)
              Focus(
                onFocusChange: (hasFocus) {
                  if (!hasFocus) {
                    _saveEdit();
                  }
                },
                child: TextField(
                  controller: _controller,
                  autofocus: true,
                  minLines: 1,
                  maxLines: 6,
                  style: AquaTypography.body1.copyWith(
                    color: colors.textSecondary,
                  ),
                  decoration: InputDecoration(
                    contentPadding: EdgeInsets.zero,
                    border: InputBorder.none,
                    fillColor: colors.surfacePrimary,
                    filled: true,
                    isDense: true,
                  ),
                  textInputAction: TextInputAction.newline,
                ),
              )
            else
              Skeletonizer(
                enabled: showSkeleton,
                child: Text(
                  showSkeleton
                      ? 'Lorem ipsum dolor sit amet, consectetur adipi.'
                      : widget.transcription.text,
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
    if (widget.isSelected) {
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
        onTap: disabled
            ? null
            : () => _copyToClipboard(context, widget.transcription.text),
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

  Widget _buildEditIcon(
    BuildContext context,
    AquaColors colors,
    bool disabled,
  ) {
    return SizedBox(
      width: 18,
      height: 18,
      child: GestureDetector(
        onTap: disabled ? null : widget.onStartEdit,
        behavior: HitTestBehavior.opaque,
        child: Opacity(
          opacity: disabled ? 0.5 : 1.0,
          child: Center(
            child: AquaIcon.note(size: 18, color: colors.textSecondary),
          ),
        ),
      ),
    );
  }

  void _copyToClipboard(BuildContext context, String text) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(context.loc.copiedToClipboard),
        duration: AppConstants.snackBarDurationShort,
      ),
    );
  }
}
