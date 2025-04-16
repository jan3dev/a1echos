import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/transcription_provider.dart';

class RecordingButton extends StatefulWidget {
  const RecordingButton({super.key});

  @override
  State<RecordingButton> createState() => _RecordingButtonState();
}

class _RecordingButtonState extends State<RecordingButton> with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late AnimationController _animationController;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);
    
    // Register observer to detect when app regains focus
    WidgetsBinding.instance.addObserver(this);
    
    // Check API key status when widget initializes
    _refreshApiKeyStatus();
  }
  
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Refresh API key status when dependencies change
    _refreshApiKeyStatus();
  }
  
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Refresh API key status when app is resumed
    if (state == AppLifecycleState.resumed) {
      _refreshApiKeyStatus();
    }
  }

  void _refreshApiKeyStatus() {
    // Use the provider to refresh API key status
    Provider.of<TranscriptionProvider>(context, listen: false).refreshApiKeyStatus();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<TranscriptionProvider>(
      builder: (context, provider, child) {
        final isRecording = provider.isRecording;
        final isTranscribing = provider.isTranscribing;
        final hasApiKey = provider.hasApiKey;
        
        if (!hasApiKey) {
          return FloatingActionButton.extended(
            onPressed: () {
              _showApiKeyMissingDialog(context);
            },
            label: const Text('Add API Key to Start'),
            icon: const Icon(Icons.key),
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
              provider.stopRecordingAndTranscribe();
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
  
  void _showApiKeyMissingDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('API Key Required'),
        content: const Text(
          'You need to add your OpenAI API key in Settings to use the transcription feature.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.pushNamed(context, '/settings').then((_) {
                // Refresh API key status when returning from settings
                _refreshApiKeyStatus();
              });
            },
            child: const Text('Go to Settings'),
          ),
        ],
      ),
    );
  }
} 