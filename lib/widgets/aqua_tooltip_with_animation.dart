import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/theme_provider.dart';
import '../models/app_theme.dart';

class AquaTooltipWithAnimation extends ConsumerStatefulWidget {
  final String message;
  final bool shouldDisappear;
  final VoidCallback? onDisappearComplete;

  const AquaTooltipWithAnimation({
    super.key,
    required this.message,
    this.shouldDisappear = false,
    this.onDisappearComplete,
  });

  @override
  ConsumerState<AquaTooltipWithAnimation> createState() =>
      _AquaTooltipWithAnimationState();
}

class _AquaTooltipWithAnimationState
    extends ConsumerState<AquaTooltipWithAnimation>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  bool _isVisible = true;
  double _scale = 1.0;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
  }

  @override
  void didUpdateWidget(AquaTooltipWithAnimation oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (!oldWidget.shouldDisappear && widget.shouldDisappear) {
      _startDisappearAnimation();
    }
  }

  void _startDisappearAnimation() async {
    setState(() {
      _scale = 0.0;
      _isVisible = false;
    });

    Future.delayed(const Duration(milliseconds: 250), () {
      if (mounted && widget.onDisappearComplete != null) {
        widget.onDisappearComplete!();
      }
    });
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

    return AnimatedSlide(
      offset: _isVisible ? Offset.zero : const Offset(0, 0.3),
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeInBack,
      child: AnimatedScale(
        scale: _scale,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeInBack,
        child: AnimatedOpacity(
          opacity: _isVisible ? 1.0 : 0.0,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeInQuart,
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, child) {
              final double offsetY = _isVisible
                  ? 4 * (1 + -1 * (1 - (2 * _controller.value)).abs())
                  : 0;
              return Transform.translate(
                offset: Offset(0, offsetY),
                child: child,
              );
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
          ),
        ),
      ),
    );
  }
}
