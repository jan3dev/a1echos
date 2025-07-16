import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/theme_provider.dart';
import '../models/app_theme.dart';

class AquaTooltipWithAnimation extends ConsumerStatefulWidget {
  final String message;

  const AquaTooltipWithAnimation({super.key, required this.message});

  @override
  ConsumerState<AquaTooltipWithAnimation> createState() =>
      _AquaTooltipWithAnimationState();
}

class _AquaTooltipWithAnimationState
    extends ConsumerState<AquaTooltipWithAnimation>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = selectedTheme.colors(context);

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        // Sine wave for smooth up/down motion, amplitude 4px
        final double offsetY =
            4 * (1 + -1 * (1 - (2 * _controller.value)).abs());
        return Transform.translate(offset: Offset(0, offsetY), child: child);
      },
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AquaTooltip(
            colors: colors,
            message: widget.message,
            pointerPosition: AquaTooltipPointerPosition.bottom,
            isDismissible: false,
          ),
        ],
      ),
    );
  }
}
