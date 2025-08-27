import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/local_transcription_provider.dart';
import '../widgets/recording_button.dart';
import '../widgets/audio_wave_visualization.dart';
import '../widgets/static_wave_bars.dart';
import '../widgets/lock_indicator.dart';

/// Recording controls component that manages the bottom recording area
class RecordingControlsView extends ConsumerStatefulWidget {
  const RecordingControlsView({super.key});

  @override
  ConsumerState<RecordingControlsView> createState() =>
      _RecordingControlsViewState();
}

class _RecordingControlsViewState extends ConsumerState<RecordingControlsView>
    with TickerProviderStateMixin {
  bool _showLockIndicator = false;
  bool _isLocked = false;

  late AnimationController _lockIndicatorAnimationController;
  late Animation<double> _lockIndicatorAnimation;

  @override
  void initState() {
    super.initState();
    _lockIndicatorAnimationController = AnimationController(
      duration: const Duration(milliseconds: 300),
      vsync: this,
    );
    _lockIndicatorAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _lockIndicatorAnimationController,
        curve: Curves.easeOut,
      ),
    );
  }

  @override
  void dispose() {
    _lockIndicatorAnimationController.dispose();
    super.dispose();
  }

  void _onLockIndicatorVisibilityChanged(bool visible) {
    if (!mounted) return;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        setState(() {
          _showLockIndicator = visible;
        });

        if (visible) {
          _lockIndicatorAnimationController.forward();
        } else {
          _lockIndicatorAnimationController.reverse();
        }
      }
    });
  }

  void _onLockStateChanged(bool isLocked) {
    if (!mounted) return;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        setState(() {
          _isLocked = isLocked;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Positioned(
      bottom: 16,
      left: 0,
      right: 0,
      child: provider.Consumer<LocalTranscriptionProvider>(
        builder: (context, transcriptionProvider, _) {
          if (transcriptionProvider.isRecording ||
              transcriptionProvider.isTranscribing) {
            return _buildRecordingLayout(transcriptionProvider);
          } else {
            return _buildReadyLayout(transcriptionProvider);
          }
        },
      ),
    );
  }

  Widget _buildRecordingLayout(
    LocalTranscriptionProvider transcriptionProvider,
  ) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (_showLockIndicator)
          LockIndicator(progress: _lockIndicatorAnimation, isLocked: _isLocked),
        if (_showLockIndicator) const SizedBox(height: 16),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: RecordingButton(
            useProviderState: true,
            onLockIndicatorVisibilityChanged: _onLockIndicatorVisibilityChanged,
            onLockStateChanged: _onLockStateChanged,
          ),
        ),
        const SizedBox(height: 16),
        if (transcriptionProvider.isTranscribing)
          SizedBox(
            height: 64,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: const StaticWaveBars(),
            ),
          )
        else
          SizedBox(
            height: 64,
            child: AudioWaveVisualization(
              state: transcriptionProvider.state,
              modelType: transcriptionProvider.selectedModelType,
              audioLevel: transcriptionProvider.audioLevel,
            ),
          ),
      ],
    );
  }

  Widget _buildReadyLayout(LocalTranscriptionProvider transcriptionProvider) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (_showLockIndicator)
          LockIndicator(progress: _lockIndicatorAnimation, isLocked: _isLocked),
        if (_showLockIndicator) const SizedBox(height: 16),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: RecordingButton(
            useProviderState: true,
            onLockIndicatorVisibilityChanged: _onLockIndicatorVisibilityChanged,
            onLockStateChanged: _onLockStateChanged,
          ),
        ),
        const SizedBox(height: 42),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: const StaticWaveBars(),
        ),
        const SizedBox(height: 26),
      ],
    );
  }
}
