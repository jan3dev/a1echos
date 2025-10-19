import 'package:flutter/material.dart';
import 'package:ui_components/config/theme_colors.dart';

/// Static wave bars shown when not recording
class AquaStaticWaveBars extends StatelessWidget {
  /// Height of the wave bars
  final double height;

  /// Total number of bars
  final int totalBars;

  /// Spacing between bars
  final double barSpacing;

  /// Minimum and maximum bar width constraints
  final double minBarWidth;
  final double maxBarWidth;

  /// Theme colors for the component
  final AquaColors colors;

  const AquaStaticWaveBars({
    super.key,
    this.height = 12.0,
    this.totalBars = 60,
    this.barSpacing = 1.0,
    this.minBarWidth = 2.0,
    this.maxBarWidth = 8.0,
    required this.colors,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final double availableWidth = constraints.maxWidth;
          final double totalSpacing = barSpacing * (totalBars - 1);
          final double barWidth = (availableWidth - totalSpacing) / totalBars;

          return Row(
            mainAxisAlignment: MainAxisAlignment.start,
            children: List.generate(totalBars, (index) {
              return Row(
                children: [
                  Container(
                    width: barWidth.clamp(minBarWidth, maxBarWidth),
                    height: height,
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
