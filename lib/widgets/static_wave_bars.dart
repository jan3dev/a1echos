import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/theme_provider.dart';
import '../models/app_theme.dart';

/// Static wave bars shown when not recording
class StaticWaveBars extends ConsumerWidget {
  const StaticWaveBars({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = selectedTheme.colors(context);

    const int totalBars = 60;
    const double barHeight = 12.0;

    return SizedBox(
      height: barHeight,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final double availableWidth = constraints.maxWidth;
          final double barSpacing = 1.0;
          final double totalSpacing = barSpacing * (totalBars - 1);
          final double barWidth = (availableWidth - totalSpacing) / totalBars;

          return Row(
            mainAxisAlignment: MainAxisAlignment.start,
            children: List.generate(totalBars, (index) {
              return Row(
                children: [
                  Container(
                    width: barWidth.clamp(2.0, 8.0),
                    height: barHeight,
                    decoration: BoxDecoration(
                      color: colors.surfaceTertiary,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                  if (index < totalBars - 1) SizedBox(width: barSpacing),
                ],
              );
            }),
          );
        },
      ),
    );
  }
}
