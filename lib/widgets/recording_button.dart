import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:ui_components/ui_components.dart';
import '../providers/local_transcription_provider.dart';
import '../constants/app_constants.dart';

class RecordingButton extends StatefulWidget {
  const RecordingButton({super.key});

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
    final aquaColors = AquaColors.lightColors;

    return Consumer<LocalTranscriptionProvider>(
      builder: (context, provider, child) {
        switch (provider.state) {
          case TranscriptionState.loading:
          case TranscriptionState.transcribing:
            return Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: aquaColors.surfaceSecondary,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black26,
                    blurRadius: 16,
                    offset: const Offset(0, 0),
                  ),
                ],
              ),
              child: Center(
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: AquaIndefinateProgressIndicator(
                    color: aquaColors.textPrimary,
                  ),
                ),
              ),
            );
          case TranscriptionState.error:
            return Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: aquaColors.accentDanger,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 16,
                    offset: const Offset(0, 0),
                  ),
                ],
              ),
              child: IconButton(
                onPressed: () {
                  _showModelErrorDialog(context, provider.error);
                },
                icon: Icon(Icons.error_outline, color: aquaColors.textInverse),
              ),
            );
          case TranscriptionState.recording:
            return Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: aquaColors.accentDanger,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: aquaColors.accentDanger.withOpacity(0.3),
                    blurRadius: 24,
                    offset: const Offset(0, 0),
                  ),
                ],
              ),
              child: IconButton(
                onPressed: () {
                  provider.stopRecordingAndSave();
                },
                icon: SvgPicture.asset(
                  'assets/icon/rectangle.svg',
                  width: 14,
                  height: 14,
                  colorFilter: ColorFilter.mode(
                    aquaColors.textInverse,
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
                color: aquaColors.surfaceInverse,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 16,
                    offset: const Offset(0, 0),
                  ),
                ],
              ),
              child: IconButton(
                onPressed: () {
                  provider.startRecording();
                },
                icon: SvgPicture.asset(
                  'assets/icon/mic.svg',
                  width: 24,
                  height: 24,
                  colorFilter: ColorFilter.mode(
                    aquaColors.textInverse,
                    BlendMode.srcIn,
                  ),
                ),
              ),
            );
        }
      },
    );
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
