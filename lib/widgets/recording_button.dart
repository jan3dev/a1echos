import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:ui_components/ui_components.dart';
import '../providers/local_transcription_provider.dart';
import '../constants/app_constants.dart';

class RecordingButton extends StatefulWidget {
  /// Callback that gets triggered when recording is started
  final VoidCallback? onRecordingStart;

  /// Callback that gets triggered when recording is stopped
  final VoidCallback? onRecordingStop;

  /// Whether the button should show in recording state
  final bool isRecording;

  /// Whether to use the provider for state or rely on passed parameters
  final bool useProviderState;

  const RecordingButton({
    super.key,
    this.onRecordingStart,
    this.onRecordingStop,
    this.isRecording = false,
    this.useProviderState = true,
  });

  @override
  State<RecordingButton> createState() => _RecordingButtonState();
}

class _RecordingButtonState extends State<RecordingButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AquaColors.lightColors;

    if (widget.useProviderState) {
      return Consumer<LocalTranscriptionProvider>(
        builder: (context, provider, child) {
          return _buildButtonForState(provider.state, colors, provider);
        },
      );
    } else {
      final state =
          widget.isRecording
              ? TranscriptionState.recording
              : TranscriptionState.ready;
      return _buildButtonForState(state, colors, null);
    }
  }

  Widget _buildButtonForState(
    TranscriptionState state,
    AquaColors colors,
    LocalTranscriptionProvider? provider,
  ) {
    switch (state) {
      case TranscriptionState.loading:
      case TranscriptionState.transcribing:
        return Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            color: colors.glassInverse,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: colors.glassInverse.withOpacity(0.04),
                blurRadius: 16,
                offset: const Offset(0, 0),
              ),
            ],
          ),
          child: Center(
            child: SizedBox(
              width: 24,
              height: 24,
              child: AquaIndefinateProgressIndicator(color: colors.textInverse),
            ),
          ),
        );
      case TranscriptionState.error:
        return Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            color: colors.accentDanger,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: colors.surfaceInverse.withOpacity(0.04),
                blurRadius: 16,
                offset: const Offset(0, 0),
              ),
            ],
          ),
          child: IconButton(
            onPressed: () {
              if (provider != null) {
                _showModelErrorDialog(context, provider.error);
              }
            },
            icon: Icon(Icons.error_outline, color: colors.textInverse),
          ),
        );
      case TranscriptionState.recording:
        return Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            color: colors.accentBrand,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: colors.accentBrand.withOpacity(0.3),
                blurRadius: 24,
                offset: const Offset(0, 0),
              ),
            ],
          ),
          child: IconButton(
            onPressed: () {
              if (widget.onRecordingStop != null) {
                widget.onRecordingStop!();
              } else if (provider != null) {
                provider.stopRecordingAndSave();
              }
            },
            icon: SvgPicture.asset(
              'assets/icons/rectangle.svg',
              width: 14,
              height: 14,
              colorFilter: ColorFilter.mode(
                colors.textInverse,
                BlendMode.srcIn,
              ),
            ),
          ),
        );
      case TranscriptionState.ready:
        return Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            color: colors.glassInverse,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: colors.glassInverse.withOpacity(0.04),
                blurRadius: 16,
                offset: const Offset(0, 0),
              ),
            ],
          ),
          child: IconButton(
            onPressed: () {
              if (widget.onRecordingStart != null) {
                widget.onRecordingStart!();
              } else if (provider != null) {
                provider.startRecording();
              }
            },
            icon: SvgPicture.asset(
              'assets/icons/mic.svg',
              width: 24,
              height: 24,
              colorFilter: ColorFilter.mode(
                colors.textInverse,
                BlendMode.srcIn,
              ),
            ),
          ),
        );
    }
  }

  void _showModelErrorDialog(BuildContext context, String? errorMessage) {
    showDialog(
      context: context,
      builder:
          (context) => AlertDialog(
            title: Text(AppStrings.modelNotReady),
            content: Text(errorMessage ?? AppStrings.modelInitFailure),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(AppStrings.ok),
              ),
            ],
          ),
    );
  }
}
