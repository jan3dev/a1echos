import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:ui_components/ui_components.dart';
import 'package:ui_components_playground/models/models.dart';
import 'package:ui_components_playground/shared/shared.dart';

import '../providers/providers.dart';

class RecordingButtonDemoPage extends HookConsumerWidget {
  const RecordingButtonDemoPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = ref.watch(prefsProvider).selectedTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 20),
        const _SectionHeader(title: 'Recording Button'),
        _RecordingButtonStatesSection(theme: theme),
        const _SectionHeader(title: 'Interactive Demo'),
        _InteractiveRecordingButtonSection(theme: theme),
        const _SectionHeader(title: 'Lock Indicator'),
        _LockIndicatorDemoSection(theme: theme),
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

class _RecordingButtonStatesSection extends HookWidget {
  const _RecordingButtonStatesSection({
    required this.theme,
  });

  final AppTheme theme;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _StateButtonPanel(
                title: 'Ready',
                state: RecordingButtonState.ready,
                theme: theme,
              ),
              _StateButtonPanel(
                title: 'Recording',
                state: RecordingButtonState.recording,
                theme: theme,
              ),
              _StateButtonPanel(
                title: 'Transcribing',
                state: RecordingButtonState.transcribing,
                theme: theme,
              ),
              _StateButtonPanel(
                title: 'Loading',
                state: RecordingButtonState.loading,
                theme: theme,
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _StateButtonPanel(
                title: 'Ready\n(Disabled)',
                state: RecordingButtonState.ready,
                theme: theme,
                enabled: false,
              ),
              _StateButtonPanel(
                title: 'Recording\n(Disabled)',
                state: RecordingButtonState.recording,
                theme: theme,
                enabled: false,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StateButtonPanel extends StatelessWidget {
  const _StateButtonPanel({
    required this.title,
    required this.state,
    required this.theme,
    this.enabled = true,
  });

  final String title;
  final RecordingButtonState state;
  final AppTheme theme;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        AquaText.subtitleSemiBold(text: title, textAlign: TextAlign.center),
        const SizedBox(height: 16),
        AquaRecordingButton(
          state: state,
          enabled: enabled,
          onRecordingStart: enabled ? () {} : null,
          onRecordingStop: enabled ? () {} : null,
        ),
      ],
    );
  }
}

class _InteractiveRecordingButtonSection extends HookWidget {
  const _InteractiveRecordingButtonSection({
    required this.theme,
  });

  final AppTheme theme;

  @override
  Widget build(BuildContext context) {
    final recordingState = useState(RecordingButtonState.ready);
    final isSimulating = useState(false);

    // Simulate recording process
    useEffect(() {
      if (isSimulating.value) {
        Future.delayed(const Duration(seconds: 3), () {
          recordingState.value = RecordingButtonState.transcribing;
          Future.delayed(const Duration(seconds: 2), () {
            recordingState.value = RecordingButtonState.ready;
            isSimulating.value = false;
          });
        });
      }
      return null;
    }, [isSimulating.value]);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      child: Column(
        children: [
          Center(
            child: Column(
              children: [
                AquaRecordingButton(
                  state: recordingState.value,
                  onRecordingStart: () {
                    recordingState.value = RecordingButtonState.recording;
                    isSimulating.value = true;
                  },
                  onRecordingStop: () {
                    recordingState.value = RecordingButtonState.transcribing;
                    isSimulating.value = true;
                  },
                ),
                const SizedBox(height: 24),
                AquaText.body1(
                  text: _getStateDescription(recordingState.value),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                if (isSimulating.value)
                  const AquaText.caption1(
                    text: 'Simulation in progress...',
                    textAlign: TextAlign.center,
                  ),
              ],
            ),
          ),
          const SizedBox(height: 32),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AquaButton.secondary(
                onPressed: () {
                  recordingState.value = RecordingButtonState.ready;
                  isSimulating.value = false;
                },
                text: 'Reset',
                size: AquaButtonSize.small,
              ),
              const SizedBox(width: 16),
              AquaButton.secondary(
                onPressed: () {
                  recordingState.value = RecordingButtonState.transcribing;
                },
                text: 'Set Transcribing',
                size: AquaButtonSize.small,
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _getStateDescription(RecordingButtonState state) {
    switch (state) {
      case RecordingButtonState.ready:
        return 'Ready to record - Tap the microphone to start recording';
      case RecordingButtonState.recording:
        return 'Recording in progress - Tap the stop button to finish';
      case RecordingButtonState.transcribing:
        return 'Processing your recording... (shows as faded ready state)';
      case RecordingButtonState.loading:
        return 'Loading state - shows faded ready state with disabled interaction';
    }
  }
}

class _LockIndicatorDemoSection extends HookWidget {
  const _LockIndicatorDemoSection({
    required this.theme,
  });

  final AppTheme theme;

  @override
  Widget build(BuildContext context) {
    final progressController = useAnimationController(
      duration: const Duration(milliseconds: 300),
    );
    final progressAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: progressController,
      curve: Curves.easeOut,
    ));

    final isLocked = useState(false);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      child: Column(
        children: [
          Center(
            child: Column(
              children: [
                AquaLockIndicator(
                  progress: progressAnimation,
                  isLocked: isLocked.value,
                  colors: theme.colors,
                ),
                const SizedBox(height: 40),
                const AquaText.body1(
                  text:
                      'Lock Indicator - Appears when dragging recording button',
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AquaButton.secondary(
                onPressed: () {
                  if (progressController.isAnimating) return;
                  if (progressAnimation.value == 0.0) {
                    progressController.forward();
                  } else {
                    progressController.reverse();
                  }
                },
                text: progressAnimation.value == 0.0
                    ? 'Show Indicator'
                    : 'Hide Indicator',
                size: AquaButtonSize.small,
              ),
              const SizedBox(width: 16),
              AquaButton.secondary(
                onPressed: () {
                  isLocked.value = !isLocked.value;
                },
                text: isLocked.value ? 'Unlock' : 'Lock',
                size: AquaButtonSize.small,
              ),
            ],
          ),
          const SizedBox(height: 32),
          const AquaText.h4(text: 'With Settings Icon Variant'),
          const SizedBox(height: 16),
          Center(
            child: AquaLockIndicatorWithSettings(
              progress: progressAnimation,
              isLocked: isLocked.value,
              colors: theme.colors,
            ),
          ),
          const SizedBox(height: 16),
          const AquaText.body2(
            text:
                'Settings icon appears 8px above the lock icon for additional functionality',
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
