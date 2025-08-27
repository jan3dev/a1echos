import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ui_components/ui_components.dart';

import '../models/app_theme.dart';
import '../providers/theme_provider.dart';

/// A lock indicator widget that appears when the user drags the recording button upwards.
class LockIndicator extends ConsumerWidget {
  final Animation<double> progress;
  final bool isLocked;
  final double width;
  final double height;

  const LockIndicator({
    super.key,
    required this.progress,
    required this.isLocked,
    this.width = 32.0,
    this.height = 72.0,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = selectedTheme.colors(context);

    return AnimatedBuilder(
      animation: progress,
      builder: (context, child) {
        final double slideIn = (1 - progress.value) * 16.0;
        return Transform.translate(
          offset: Offset(0, slideIn),
          child: Opacity(
            opacity: progress.value,
            child: Container(
              width: width,
              height: height,
              decoration: BoxDecoration(
                color: colors.glassSurface.withOpacity(0.5),
                borderRadius: BorderRadius.circular(width / 2),
                boxShadow: [
                  BoxShadow(color: AquaPrimitiveColors.shadow, blurRadius: 16),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(width / 2),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 80, sigmaY: 80),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 4,
                      vertical: 8,
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        AquaIcon.lock(color: colors.textPrimary, size: 24),
                        const SizedBox(height: 8),
                        AquaIcon.chevronUp(
                          color: colors.textTertiary,
                          size: 24,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
