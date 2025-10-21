import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:ui_components/ui_components.dart';
import 'package:ui_components_playground/models/models.dart';

import '../providers/providers.dart';
import '../shared/extensions/extensions.dart';

class FooterDemoPage extends HookConsumerWidget {
  const FooterDemoPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = ref.watch(prefsProvider).selectedTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 20),
        const _SectionHeader(title: 'Recording Controls View'),
        _RecordingControlsStatesSection(theme: theme),
        const _SectionHeader(title: 'Interactive Demo'),
        _InteractiveRecordingControlsDemo(theme: theme),
        const SizedBox(height: 20),
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.title,
  });

  final String title;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: AquaText.h4SemiBold(text: title),
    );
  }
}

class _RecordingControlsStatesSection extends HookWidget {
  const _RecordingControlsStatesSection({
    required this.theme,
  });

  final AppTheme theme;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      child: Column(
        children: [
          _StatePanel(
            title: 'Ready State',
            description:
                'Ready to start recording - shows dark microphone button (in light theme) and static wave bars',
            state: RecordingControlsState.ready,
            theme: theme,
          ),
          const SizedBox(height: 32),
          _StatePanel(
            title: 'Recording State',
            description:
                'Currently recording - shows animated wave visualization',
            state: RecordingControlsState.recording,
            audioLevel: 0.7,
            theme: theme,
          ),
          const SizedBox(height: 32),
          _StatePanel(
            title: 'Transcribing State',
            description:
                'Processing recording - shows faded dark button (in light theme) and static wave bars',
            state: RecordingControlsState.transcribing,
            theme: theme,
          ),
          const SizedBox(height: 32),
          _StatePanel(
            title: 'Loading State',
            description:
                'Loading state - shows faded dark button (in light theme) with disabled interaction',
            state: RecordingControlsState.loading,
            theme: theme,
          ),
        ],
      ),
    );
  }
}

class _StatePanel extends StatelessWidget {
  const _StatePanel({
    required this.title,
    required this.description,
    required this.state,
    required this.theme,
    this.audioLevel = 0.0,
  });

  final String title;
  final String description;
  final RecordingControlsState state;
  final AppTheme theme;
  final double audioLevel;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AquaText.h5SemiBold(text: title),
        const SizedBox(height: 8),
        AquaText.body2(text: description),
        const SizedBox(height: 16),
        Container(
          height: 200,
          decoration: BoxDecoration(
            border: Border.all(color: Theme.of(context).colorScheme.outline),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Stack(
            children: [
              // Background to simulate the full screen
              Container(
                color: Theme.of(context).colorScheme.surface,
              ),
              // The recording controls view
              AquaRecordingControlsView(
                state: state,
                audioLevel: audioLevel,
                colors: theme.colors,
                onRecordingStart: () {},
                onRecordingStop: () {},
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _InteractiveRecordingControlsDemo extends HookWidget {
  const _InteractiveRecordingControlsDemo({
    required this.theme,
  });

  final AppTheme theme;

  @override
  Widget build(BuildContext context) {
    final recordingState = useState(RecordingControlsState.ready);
    final audioLevel = useState(0.0);
    final isSimulating = useState(false);

    // Simulate audio level changes when recording
    useEffect(() {
      if (recordingState.value == RecordingControlsState.recording &&
          isSimulating.value) {
        final timer =
            Timer.periodic(const Duration(milliseconds: 100), (timer) {
          if (recordingState.value == RecordingControlsState.recording) {
            audioLevel.value = 0.3 + (math.Random().nextDouble() * 0.7);
          } else {
            timer.cancel();
          }
        });
        return timer.cancel;
      }
      return null;
    }, [recordingState.value, isSimulating.value]);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      child: Column(
        children: [
          Container(
            height: 300,
            decoration: BoxDecoration(
              border: Border.all(color: Theme.of(context).colorScheme.outline),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Stack(
              children: [
                Container(
                  color: Theme.of(context).colorScheme.surface,
                ),
                AquaRecordingControlsView(
                  state: recordingState.value,
                  audioLevel: audioLevel.value,
                  colors: theme.colors,
                  onRecordingStart: () {
                    recordingState.value = RecordingControlsState.recording;
                    isSimulating.value = true;
                  },
                  onRecordingStop: () {
                    recordingState.value = RecordingControlsState.transcribing;
                    isSimulating.value = false;
                    audioLevel.value = 0.0;
                    // Simulate transcribing completion
                    Future.delayed(const Duration(seconds: 3), () {
                      recordingState.value = RecordingControlsState.ready;
                    });
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Center(
            child: Column(
              children: [
                AquaText.body1(
                  text: _getStateDescription(recordingState.value),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                if (isSimulating.value)
                  AquaText.caption1(
                    text: 'Audio Level: ${(audioLevel.value * 100).round()}%',
                    textAlign: TextAlign.center,
                  ),
              ],
            ),
          ),
          const SizedBox(height: 32),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 16,
            runSpacing: 12,
            children: [
              AquaButton.secondary(
                onPressed: () {
                  recordingState.value = RecordingControlsState.ready;
                  isSimulating.value = false;
                  audioLevel.value = 0.0;
                },
                text: 'Reset',
                size: AquaButtonSize.small,
              ),
              AquaButton.secondary(
                onPressed: () {
                  recordingState.value = RecordingControlsState.transcribing;
                  isSimulating.value = false;
                  audioLevel.value = 0.0;
                },
                text: 'Set Transcribing',
                size: AquaButtonSize.small,
              ),
              AquaButton.secondary(
                onPressed: () {
                  recordingState.value = RecordingControlsState.loading;
                  isSimulating.value = false;
                  audioLevel.value = 0.0;
                },
                text: 'Set Loading',
                size: AquaButtonSize.small,
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _getStateDescription(RecordingControlsState state) {
    switch (state) {
      case RecordingControlsState.ready:
        return 'Ready to record - Tap the microphone to start recording';
      case RecordingControlsState.recording:
        return 'Recording in progress - Tap the stop button to finish';
      case RecordingControlsState.transcribing:
        return 'Processing your recording... (shows as faded dark button)';
      case RecordingControlsState.loading:
        return 'Loading state - shows faded dark button with disabled interaction';
    }
  }
}
