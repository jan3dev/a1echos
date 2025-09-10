import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:ui_components/ui_components.dart';
import 'package:ui_components_playground/shared/extensions/extensions.dart';

import '../providers/providers.dart';

class TranscriptionItemDemoPage extends HookConsumerWidget {
  const TranscriptionItemDemoPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = ref.watch(prefsProvider).selectedTheme;
    final colors = theme.colors;

    // Create sample transcription data
    final sampleTranscription = TranscriptionItemData(
      id: 'sample-1',
      text:
          'This is a sample transcription text that demonstrates the component in action.',
      timestamp: DateTime.now().subtract(const Duration(minutes: 5)),
      audioPath: '/sample/audio.wav',
    );

    final emptyTranscription = TranscriptionItemData(
      id: 'sample-2',
      text: '',
      timestamp: DateTime.now(),
      audioPath: '/sample/audio2.wav',
    );

    return Column(
      children: [
        // Default State
        _DemoSection(
          title: 'Default State',
          child: AquaTranscriptionItem(
            colors: colors,
            transcription: sampleTranscription,
            onTap: () {},
            onLongPress: () {},
            onStartEdit: () {},
            onEndEdit: () {},
          ),
        ),

        // Editing Mode
        _DemoSection(
          title: 'Editing Mode',
          child: AquaTranscriptionItem(
            colors: colors,
            transcription: sampleTranscription,
            isEditing: true,
            onTap: () {},
            onLongPress: () {},
            onStartEdit: () {},
            onEndEdit: () {},
          ),
        ),

        // Selection Mode - Unselected
        _DemoSection(
          title: 'Selection Mode - Unselected',
          child: AquaTranscriptionItem(
            colors: colors,
            transcription: sampleTranscription,
            selectionMode: true,
            isSelected: false,
            onTap: () {},
            onLongPress: () {},
            onStartEdit: () {},
            onEndEdit: () {},
          ),
        ),

        // Selection Mode - Selected
        _DemoSection(
          title: 'Selection Mode - Selected',
          child: AquaTranscriptionItem(
            colors: colors,
            transcription: sampleTranscription,
            selectionMode: true,
            isSelected: true,
            onTap: () {},
            onLongPress: () {},
            onStartEdit: () {},
            onEndEdit: () {},
          ),
        ),

        // Loading/Transcribe Mode - Whisper Loading
        _DemoSection(
          title: 'Loading Mode - Whisper',
          child: AquaTranscriptionItem(
            colors: colors,
            transcription: sampleTranscription,
            isLoadingWhisperResult: true,
            onTap: () {},
            onLongPress: () {},
            onStartEdit: () {},
            onEndEdit: () {},
          ),
        ),

        // Loading/Transcribe Mode - Vosk Loading
        _DemoSection(
          title: 'Loading Mode - Vosk',
          child: AquaTranscriptionItem(
            colors: colors,
            transcription: sampleTranscription,
            isLoadingVoskResult: true,
            onTap: () {},
            onLongPress: () {},
            onStartEdit: () {},
            onEndEdit: () {},
          ),
        ),

        // Loading/Transcribe Mode - Whisper Recording
        _DemoSection(
          title: 'Transcribe Mode - Whisper Recording',
          child: AquaTranscriptionItem(
            colors: colors,
            transcription: sampleTranscription,
            isWhisperRecording: true,
            onTap: () {},
            onLongPress: () {},
            onStartEdit: () {},
            onEndEdit: () {},
          ),
        ),

        // Live Preview Item - Empty
        _DemoSection(
          title: 'Live Preview - Empty Text',
          child: AquaTranscriptionItem(
            colors: colors,
            transcription: emptyTranscription,
            isLivePreviewItem: true,
            onTap: () {},
            onLongPress: () {},
            onStartEdit: () {},
            onEndEdit: () {},
          ),
        ),

        // Interactive Demo
        _InteractiveDemoSection(colors: colors),
      ],
    );
  }
}

class _DemoSection extends StatelessWidget {
  const _DemoSection({
    required this.title,
    required this.child,
  });

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          child: AquaText.h3SemiBold(text: title),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: child,
        ),
        const SizedBox(height: 40),
      ],
    );
  }
}

class _InteractiveDemoSection extends HookWidget {
  const _InteractiveDemoSection({
    required this.colors,
  });

  final AquaColors colors;

  @override
  Widget build(BuildContext context) {
    final isEditing = useState(false);
    final selectionMode = useState(false);
    final isSelected = useState(false);
    final isLoadingWhisper = useState(false);
    final isLoadingVosk = useState(false);
    final isWhisperRecording = useState(false);

    final sampleTranscription = TranscriptionItemData(
      id: 'interactive-1',
      text:
          'This is an interactive demo. You can toggle different states using the controls below.',
      timestamp: DateTime.now().subtract(const Duration(minutes: 10)),
      audioPath: '/interactive/audio.wav',
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          child: const AquaText.h3SemiBold(text: 'Interactive Demo'),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            children: [
              // State Toggles
              Wrap(
                spacing: 16,
                runSpacing: 8,
                children: [
                  _StateToggle(
                    label: 'Editing',
                    value: isEditing.value,
                    onChanged: (value) => isEditing.value = value,
                  ),
                  _StateToggle(
                    label: 'Selection Mode',
                    value: selectionMode.value,
                    onChanged: (value) => selectionMode.value = value,
                  ),
                  _StateToggle(
                    label: 'Selected',
                    value: isSelected.value,
                    onChanged: (value) => isSelected.value = value,
                    enabled: selectionMode.value,
                  ),
                  _StateToggle(
                    label: 'Whisper Loading',
                    value: isLoadingWhisper.value,
                    onChanged: (value) => isLoadingWhisper.value = value,
                  ),
                  _StateToggle(
                    label: 'Vosk Loading',
                    value: isLoadingVosk.value,
                    onChanged: (value) => isLoadingVosk.value = value,
                  ),
                  _StateToggle(
                    label: 'Whisper Recording',
                    value: isWhisperRecording.value,
                    onChanged: (value) => isWhisperRecording.value = value,
                  ),
                ],
              ),
              const SizedBox(height: 20),
              // Demo Component
              AquaTranscriptionItem(
                colors: colors,
                transcription: sampleTranscription,
                selectionMode: selectionMode.value,
                isSelected: isSelected.value,
                isEditing: isEditing.value,
                isLoadingWhisperResult: isLoadingWhisper.value,
                isLoadingVoskResult: isLoadingVosk.value,
                isWhisperRecording: isWhisperRecording.value,
                onTap: () {
                  if (selectionMode.value) {
                    isSelected.value = !isSelected.value;
                  }
                },
                onLongPress: () {
                  if (!selectionMode.value) {
                    selectionMode.value = true;
                  }
                },
                onStartEdit: () => isEditing.value = true,
                onEndEdit: () => isEditing.value = false,
              ),
            ],
          ),
        ),
        const SizedBox(height: 40),
      ],
    );
  }
}

class _StateToggle extends StatelessWidget {
  const _StateToggle({
    required this.label,
    required this.value,
    required this.onChanged,
    this.enabled = true,
  });

  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1.0 : 0.5,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          AquaText.body2Medium(text: label),
          const SizedBox(width: 12),
          AquaToggle(
            value: value,
            onChanged: enabled ? onChanged : null,
          ),
        ],
      ),
    );
  }
}
