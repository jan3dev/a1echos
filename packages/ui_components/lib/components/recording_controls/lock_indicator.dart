import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';

/// A lock indicator widget that appears when the user drags the recording button upwards.
class AquaLockIndicator extends StatefulWidget {
  /// The progress animation that controls the opacity and slide-in effect
  final Animation<double> progress;

  /// Whether the lock is currently locked
  final bool isLocked;

  /// Width of the indicator container
  final double width;

  /// Height of the indicator container
  final double height;

  /// Whether to show the settings icon variant
  final bool showSettingsIcon;

  /// The design system colors
  final AquaColors colors;

  const AquaLockIndicator({
    super.key,
    required this.progress,
    required this.isLocked,
    required this.colors,
    this.width = 32.0,
    this.height = 72.0,
    this.showSettingsIcon = false,
  });

  @override
  State<AquaLockIndicator> createState() => _AquaLockIndicatorState();
}

class _AquaLockIndicatorState extends State<AquaLockIndicator> {
  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.progress,
      builder: (context, child) {
        final double slideIn = (1 - widget.progress.value) * 16.0;
        return Transform.translate(
          offset: Offset(0, slideIn),
          child: Opacity(
            opacity: widget.progress.value,
            child: Container(
              width: widget.width,
              height: widget.height,
              decoration: BoxDecoration(
                color: widget.colors.surfacePrimary.withOpacity(0.5),
                borderRadius: BorderRadius.circular(widget.width / 2),
                boxShadow: const [
                  BoxShadow(
                    color: AquaPrimitiveColors.shadow,
                    blurRadius: 16,
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(widget.width / 2),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 80, sigmaY: 80),
                  child: Container(
                    padding: widget.showSettingsIcon
                        ? const EdgeInsets.symmetric(horizontal: 8, vertical: 8)
                        : const EdgeInsets.symmetric(
                            horizontal: 4, vertical: 8),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (widget.showSettingsIcon) ...[
                          AquaIcon.settings(
                            color: widget.colors.textPrimary,
                            size: 24,
                          ),
                          const SizedBox(height: 8),
                        ],
                        AquaIcon.lock(
                          color: widget.colors.textPrimary,
                          size: 24,
                        ),
                        const SizedBox(height: 8),
                        AquaIcon.chevronUp(
                          color: widget.colors.textTertiary,
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

/// A variant of the lock indicator that includes a settings icon above the lock.
class AquaLockIndicatorWithSettings extends AquaLockIndicator {
  const AquaLockIndicatorWithSettings({
    super.key,
    required super.progress,
    required super.isLocked,
    required super.colors,
    super.width = 40.0,
    super.height = 104.0,
  }) : super(showSettingsIcon: true);
}
