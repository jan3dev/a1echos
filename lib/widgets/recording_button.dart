import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/local_transcription_provider.dart';

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
    return Consumer<LocalTranscriptionProvider>(
      builder: (context, provider, child) {
        // Drive the button UI from the unified state
        switch (provider.state) {
          case TranscriptionState.loading:
          case TranscriptionState.transcribing:
            return const FloatingActionButton(
              onPressed: null,
              backgroundColor: Colors.grey,
              child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  color: Colors.white,
                  strokeWidth: 2,
                ),
              ),
            );
          case TranscriptionState.error:
            return FloatingActionButton.extended(
              onPressed: () {
                _showModelErrorDialog(context, provider.error);
              },
              label: const Text('Model Error'),
              icon: const Icon(Icons.error_outline),
              backgroundColor: Colors.amber.shade700,
            );
          case TranscriptionState.recording:
            return FloatingActionButton(
              onPressed: () {
                provider.stopRecordingAndSave();
              },
              backgroundColor: Colors.red,
              child: AnimatedBuilder(
                animation: _animationController,
                builder: (context, child) {
                  return Transform.scale(
                    scale: 0.8 + (_animationController.value * 0.2),
                    child: child,
                  );
                },
                child: const Icon(Icons.stop),
              ),
            );
          case TranscriptionState.ready:
            return FloatingActionButton(
              onPressed: () {
                provider.startRecording();
              },
              child: const Icon(Icons.mic),
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
            title: const Text('Model Not Ready'),
            content: Text(
              errorMessage ??
                  'The selected speech recognition model failed to initialize. Please check settings, ensure model files are present, and restart the app.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('OK'),
              ),
            ],
          ),
    );
  }
}
