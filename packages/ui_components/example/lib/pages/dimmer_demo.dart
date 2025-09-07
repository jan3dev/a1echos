import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:ui_components/ui_components.dart';
import 'package:ui_components_playground/providers/providers.dart';
import 'package:ui_components_playground/shared/shared.dart';

class DimmerDemoPage extends HookConsumerWidget {
  const DimmerDemoPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = ref.watch(prefsProvider).selectedTheme;

    return Container(
      margin: const EdgeInsets.all(20),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                constraints: const BoxConstraints(
                  maxWidth: 343,
                ),
                child: AquaButton.utility(
                  text: 'Show Dimmer',
                  onPressed: () => AquaDimmer.show(
                    context,
                    colors: theme.colors,
                    child: Center(
                      child: Container(
                        padding: const EdgeInsets.all(20),
                        margin: const EdgeInsets.symmetric(horizontal: 40),
                        decoration: BoxDecoration(
                          color: theme.colors.surfacePrimary,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            AquaText.h4Medium(
                              text: 'Dimmer Overlay Demo',
                              color: theme.colors.textPrimary,
                            ),
                            const SizedBox(height: 16),
                            AquaText.body1Medium(
                              text:
                                  'This is a demo of the dimmer background overlay with custom content and blur effect.',
                              color: theme.colors.textSecondary,
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 24),
                            AquaButton.primary(
                              text: 'Close',
                              onPressed: () => Navigator.of(context).pop(),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 20),
              Container(
                constraints: const BoxConstraints(
                  maxWidth: 343,
                ),
                child: AquaButton.utility(
                  text: 'Show Dimmer (Empty)',
                  onPressed: () => AquaDimmer.show(
                    context,
                    colors: theme.colors,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 40),
          // Static preview of the dimmer component
          Container(
            height: 300,
            width: double.infinity,
            decoration: BoxDecoration(
              border: Border.all(
                color: theme.colors.surfaceBorderSecondary,
              ),
              borderRadius: BorderRadius.circular(8),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: AquaDimmer(
                colors: theme.colors,
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    margin: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: theme.colors.surfacePrimary.withAlpha(200),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: AquaText.body1Medium(
                      text: 'Static preview of the dimmer with content',
                      color: theme.colors.textPrimary,
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),
          AquaText.body2(
            text:
                'Above is a static preview of the AquaDimmer background overlay. Use the buttons above to see the interactive dimmer with 24px blur and 4% opacity.',
            color: theme.colors.textTertiary,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
