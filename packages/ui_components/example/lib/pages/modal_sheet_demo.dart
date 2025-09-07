import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:ui_components/ui_components.dart';
import 'package:ui_components_playground/providers/providers.dart';
import 'package:ui_components_playground/shared/shared.dart';

class ModalSheetDemoPage extends HookConsumerWidget {
  const ModalSheetDemoPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = ref.watch(prefsProvider).selectedTheme;

    final icon = useMemoized(() {
      return AquaIcon.pending(
        color: theme.colors.textTertiary,
      );
    }, [theme]);

    return Container(
      margin: const EdgeInsets.all(20),
      child: Column(
        children: [
          Wrap(
            spacing: 20,
            runSpacing: 12,
            children: [
              Container(
                constraints: const BoxConstraints(
                  maxWidth: 343,
                ),
                child: AquaButton.utility(
                  text: 'Primary + Secondary',
                  onPressed: () => AquaModalSheet.show(
                    context,
                    colors: theme.colors,
                    icon: icon,
                    title: 'Sheet Title',
                    message: 'Sheet text will appear here',
                    primaryButtonText: 'Primary',
                    secondaryButtonText: 'Secondary',
                    onPrimaryButtonTap: () => Navigator.of(context).pop(),
                    onSecondaryButtonTap: () => Navigator.of(context).pop(),
                  ),
                ),
              ),
              Container(
                constraints: const BoxConstraints(
                  maxWidth: 343,
                ),
                child: AquaButton.utility(
                  text: 'Primary',
                  onPressed: () => AquaModalSheet.show(
                    context,
                    colors: theme.colors,
                    icon: icon,
                    title: 'Sheet Title',
                    message: 'Sheet text will appear here',
                    primaryButtonText: 'Primary',
                    onPrimaryButtonTap: () => Navigator.of(context).pop(),
                  ),
                ),
              ),
              Container(
                constraints: const BoxConstraints(
                  maxWidth: 343,
                ),
                child: AquaButton.utility(
                  text: 'Primary with Long Title & Message',
                  onPressed: () => AquaModalSheet.show(
                    context,
                    colors: theme.colors,
                    icon: icon,
                    title:
                        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
                    message:
                        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
                    primaryButtonText: 'Primary',
                    onPrimaryButtonTap: () => Navigator.of(context).pop(),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                constraints: const BoxConstraints(
                  maxWidth: 343,
                ),
                child: AquaButton.utility(
                  text: 'Primary + Secondary + No Icon',
                  onPressed: () => AquaModalSheet.show(
                    context,
                    colors: theme.colors,
                    title: 'Sheet Title',
                    message: 'Sheet text will appear here',
                    primaryButtonText: 'Primary',
                    secondaryButtonText: 'Secondary',
                    onPrimaryButtonTap: () => Navigator.of(context).pop(),
                    onSecondaryButtonTap: () => Navigator.of(context).pop(),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Wrap(
            spacing: 20,
            runSpacing: 12,
            children: [
              Container(
                constraints: const BoxConstraints(
                  maxWidth: 343,
                ),
                child: AquaButton.utility(
                  text: 'Normal Variant',
                  onPressed: () => AquaModalSheet.show(
                    context,
                    colors: theme.colors,
                    icon: icon,
                    title: 'Sheet Title',
                    message: 'Sheet text will appear here',
                    primaryButtonText: 'Primary',
                    secondaryButtonText: 'Secondary',
                    onPrimaryButtonTap: () => Navigator.of(context).pop(),
                    onSecondaryButtonTap: () => Navigator.of(context).pop(),
                  ),
                ),
              ),
              Container(
                constraints: const BoxConstraints(
                  maxWidth: 343,
                ),
                child: AquaButton.utility(
                  text: 'Success Variant',
                  onPressed: () => AquaModalSheet.show(
                    context,
                    colors: theme.colors,
                    icon: AquaIcon.checkCircle(color: Colors.white),
                    iconVariant: AquaModalSheetVariant.success,
                    primaryButtonVariant: AquaButtonVariant.success,
                    secondaryButtonVariant: AquaButtonVariant.success,
                    title: 'Sheet Title',
                    message: 'Sheet text will appear here',
                    primaryButtonText: 'Primary',
                    secondaryButtonText: 'Secondary',
                    onPrimaryButtonTap: () => Navigator.of(context).pop(),
                    onSecondaryButtonTap: () => Navigator.of(context).pop(),
                  ),
                ),
              ),
              Container(
                constraints: const BoxConstraints(
                  maxWidth: 343,
                ),
                child: AquaButton.utility(
                  text: 'Danger Variant',
                  onPressed: () => AquaModalSheet.show(
                    context,
                    colors: theme.colors,
                    icon: AquaIcon.danger(color: Colors.white),
                    iconVariant: AquaModalSheetVariant.danger,
                    primaryButtonVariant: AquaButtonVariant.error,
                    secondaryButtonVariant: AquaButtonVariant.error,
                    title: 'Sheet Title',
                    message: 'Sheet text will appear here',
                    primaryButtonText: 'Primary',
                    secondaryButtonText: 'Secondary',
                    onPrimaryButtonTap: () => Navigator.of(context).pop(),
                    onSecondaryButtonTap: () => Navigator.of(context).pop(),
                  ),
                ),
              ),
              Container(
                constraints: const BoxConstraints(
                  maxWidth: 343,
                ),
                child: AquaButton.utility(
                  text: 'Warning Variant',
                  onPressed: () => AquaModalSheet.show(
                    context,
                    colors: theme.colors,
                    icon: AquaIcon.warning(color: Colors.white),
                    iconVariant: AquaModalSheetVariant.warning,
                    primaryButtonVariant: AquaButtonVariant.warning,
                    secondaryButtonVariant: AquaButtonVariant.warning,
                    title: 'Sheet Title',
                    message: 'Sheet text will appear here',
                    primaryButtonText: 'Primary',
                    secondaryButtonText: 'Secondary',
                    onPrimaryButtonTap: () => Navigator.of(context).pop(),
                    onSecondaryButtonTap: () => Navigator.of(context).pop(),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 40),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                constraints: const BoxConstraints(
                  maxWidth: 343,
                ),
                child: AquaModalSheet(
                  colors: theme.colors,
                  icon: icon,
                  title: 'Sheet Title',
                  message: 'Sheet text will appear here',
                  primaryButtonText: 'Primary',
                  secondaryButtonText: 'Secondary',
                  onPrimaryButtonTap: () {},
                  onSecondaryButtonTap: () {},
                ),
              ),
              const SizedBox(width: 20),
              Container(
                constraints: const BoxConstraints(
                  maxWidth: 343,
                ),
                child: AquaModalSheet(
                  colors: theme.colors,
                  icon: icon,
                  title: 'Sheet Title',
                  message: 'Sheet text will appear here',
                  primaryButtonText: 'Primary',
                  onPrimaryButtonTap: () {},
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
