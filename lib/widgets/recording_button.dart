import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/local_transcription_provider.dart';

class RecordingButton extends StatefulWidget {
  const RecordingButton({super.key});

  @override
  State<RecordingButton> createState() => _RecordingButtonState();
}

class _RecordingButtonState extends State<RecordingButton>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late AnimationController _animationController;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);

    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // Check model status when app is resumed
      _refreshModelStatus();
    }
  }

  void _refreshModelStatus() {
    // Nothing to do - model status is checked at provider initialization
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<LocalTranscriptionProvider>(
      builder: (context, provider, child) {
        final isRecording = provider.isRecording;
        final isTranscribing = provider.isTranscribing;
        final isModelReady = provider.isModelReady;

        if (!isModelReady) {
          return FloatingActionButton.extended(
            onPressed: () {
              _showModelMissingDialog(context);
            },
            label: const Text('Model Not Found'),
            icon: const Icon(Icons.error_outline),
            backgroundColor: Colors.amber,
          );
        }

        if (isTranscribing) {
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
        }

        if (isRecording) {
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
        }

        return FloatingActionButton(
          onPressed: () {
            provider.startRecording();
          },
          child: const Icon(Icons.mic),
        );
      },
    );
  }

  void _showModelMissingDialog(BuildContext context) {
    showDialog(
      context: context,
      builder:
          (context) => AlertDialog(
            title: const Text('Model Initialization Failed'),
            content: const Text(
              'The speech recognition model failed to initialize. Please restart the app and try again.',
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
