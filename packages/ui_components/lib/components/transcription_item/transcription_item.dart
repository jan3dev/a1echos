import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:ui_components/ui_components.dart';
import 'package:intl/intl.dart';
import 'package:skeletonizer/skeletonizer.dart';

/// A simple transcription model for the design system component
class TranscriptionItemData {
  final String id;
  final String sessionId;
  final String text;
  final DateTime timestamp;
  final String audioPath;

  const TranscriptionItemData({
    required this.id,
    this.sessionId = 'default_session',
    required this.text,
    required this.timestamp,
    required this.audioPath,
  });

  factory TranscriptionItemData.fromJson(Map<String, dynamic> json) {
    return TranscriptionItemData(
      id: json['id'],
      sessionId: json['sessionId'] ?? 'default_session',
      text: json['text'],
      timestamp: DateTime.parse(json['timestamp']),
      audioPath: json['audioPath'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'sessionId': sessionId,
      'text': text,
      'timestamp': timestamp.toIso8601String(),
      'audioPath': audioPath,
    };
  }
}

class AquaTranscriptionItem extends StatefulWidget {
  final TranscriptionItemData transcription;
  final bool selectionMode;
  final bool isSelected;
  final bool isLivePreviewItem;
  final bool isLoadingWhisperResult;
  final bool isLoadingVoskResult;
  final bool isWhisperRecording;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final bool isEditing;
  final bool isAnyEditing;
  final VoidCallback? onStartEdit;
  final VoidCallback? onEndEdit;
  final AquaColors? colors;
  final Function(TranscriptionItemData)? onTranscriptionUpdate;

  const AquaTranscriptionItem({
    super.key,
    required this.transcription,
    this.selectionMode = false,
    this.isSelected = false,
    this.isLivePreviewItem = false,
    this.isLoadingWhisperResult = false,
    this.isLoadingVoskResult = false,
    this.isWhisperRecording = false,
    this.onTap,
    this.onLongPress,
    this.isEditing = false,
    this.isAnyEditing = false,
    this.onStartEdit,
    this.onEndEdit,
    this.colors,
    this.onTranscriptionUpdate,
  });

  @override
  State<AquaTranscriptionItem> createState() => AquaTranscriptionItemState();
}

class AquaTranscriptionItemState extends State<AquaTranscriptionItem> {
  late TextEditingController _controller;
  bool _cancelled = false;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.transcription.text);
  }

  @override
  void didUpdateWidget(covariant AquaTranscriptionItem oldWidget) {
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
      widget.onEndEdit?.call();
      return;
    }
    final newText = _controller.text.trim();
    if (newText.isEmpty || newText == widget.transcription.text) {
      widget.onEndEdit?.call();
      _controller.text = widget.transcription.text;
      return;
    }

    // Update the transcription data if callback is provided
    if (widget.onTranscriptionUpdate != null) {
      final updatedTranscription = TranscriptionItemData(
        id: widget.transcription.id,
        sessionId: widget.transcription.sessionId,
        text: newText,
        timestamp: widget.transcription.timestamp,
        audioPath: widget.transcription.audioPath,
      );
      widget.onTranscriptionUpdate!(updatedTranscription);
    }

    widget.onEndEdit?.call();
  }

  /// Cancel the current edit operation (can be called externally)
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

    // Use provided colors or get from theme
    final theme = Theme.of(context);
    final colors = widget.colors;

    Color backgroundColor = colors?.surfacePrimary ?? theme.colorScheme.surface;
    if (widget.selectionMode && widget.isSelected) {
      backgroundColor =
          colors?.surfaceSelected ?? theme.colorScheme.surfaceContainerHighest;
    }

    bool showSkeleton = widget.isLoadingWhisperResult ||
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
          widget.onTap?.call();
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
              ? Border.all(
                  color: colors?.accentBrand ?? theme.colorScheme.primary,
                  width: 1)
              : null,
          boxShadow: [
            BoxShadow(
              color: (colors?.surfacePrimary ?? theme.colorScheme.surface)
                  .withOpacity(0.04),
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
                          text: (showSkeleton ||
                                  !(widget.isLivePreviewItem &&
                                      widget.transcription.text.isEmpty))
                              ? dateFormat.format(
                                  widget.transcription.timestamp,
                                )
                              : "",
                          style: AquaTypography.caption1Medium.copyWith(
                            color: colors?.textSecondary ??
                                theme.colorScheme.onSurface,
                          ),
                        ),
                        const TextSpan(text: '  '),
                        TextSpan(
                          text: (showSkeleton ||
                                  !(widget.isLivePreviewItem &&
                                      widget.transcription.text.isEmpty))
                              ? timeFormat.format(
                                  widget.transcription.timestamp,
                                )
                              : "",
                          style: AquaTypography.caption1Medium.copyWith(
                            color: colors?.textTertiary ??
                                theme.colorScheme.onSurfaceVariant,
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
                    color: colors?.textSecondary ?? theme.colorScheme.onSurface,
                  ),
                  decoration: InputDecoration(
                    contentPadding: EdgeInsets.zero,
                    border: InputBorder.none,
                    fillColor:
                        colors?.surfacePrimary ?? theme.colorScheme.surface,
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
                      ? 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do e'
                      : widget.transcription.text,
                  style: AquaTypography.body1.copyWith(
                    color: colors?.textSecondary ?? theme.colorScheme.onSurface,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildCheckbox(AquaColors? colors) {
    if (widget.isSelected) {
      return const AquaCheckBox.small(value: true, onChanged: null);
    } else {
      return const AquaCheckBox.small(value: false, onChanged: null);
    }
  }

  Widget _buildCopyIcon(
    BuildContext context,
    AquaColors? colors,
    bool disabled,
  ) {
    final theme = Theme.of(context);
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
            child: AquaIcon.copy(
                size: 18,
                color: colors?.textSecondary ?? theme.colorScheme.onSurface),
          ),
        ),
      ),
    );
  }

  Widget _buildEditIcon(
    BuildContext context,
    AquaColors? colors,
    bool disabled,
  ) {
    final theme = Theme.of(context);
    return SizedBox(
      width: 18,
      height: 18,
      child: GestureDetector(
        onTap: disabled ? null : widget.onStartEdit,
        behavior: HitTestBehavior.opaque,
        child: Opacity(
          opacity: disabled ? 0.5 : 1.0,
          child: Center(
            child: AquaIcon.edit(
                size: 18,
                color: colors?.textSecondary ?? theme.colorScheme.onSurface),
          ),
        ),
      ),
    );
  }

  void _copyToClipboard(BuildContext context, String text) {
    Clipboard.setData(ClipboardData(text: text));
    // Show confirmation snackbar
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Copied to clipboard'),
        duration: Duration(seconds: 2),
      ),
    );
  }
}
