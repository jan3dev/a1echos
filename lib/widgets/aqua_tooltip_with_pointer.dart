import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';
import 'package:flutter_svg/flutter_svg.dart';

class AquaTooltipWithPointer extends StatefulWidget {
  final String message;
  final VoidCallback? onLeadingIconTap;
  final VoidCallback? onTrailingIconTap;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final Color? trailingIconColor;
  final bool isDismissible;
  final bool isInfo;
  final Widget? leadingIcon;
  final EdgeInsets margin;
  final Widget? trailingIcon;

  const AquaTooltipWithPointer({
    super.key,
    required this.message,
    this.onLeadingIconTap,
    this.onTrailingIconTap,
    this.backgroundColor,
    this.foregroundColor,
    this.trailingIconColor,
    this.isDismissible = false,
    this.isInfo = false,
    this.leadingIcon,
    this.margin = const EdgeInsets.only(left: 16, right: 16, top: 16),
    this.trailingIcon,
  });

  @override
  State<AquaTooltipWithPointer> createState() => _AquaTooltipWithPointerState();
}

class _AquaTooltipWithPointerState extends State<AquaTooltipWithPointer> with SingleTickerProviderStateMixin {
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
    final Color pointerColor = widget.backgroundColor ?? AquaColors.lightColors.glassInverse;
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        // Sine wave for smooth up/down motion, amplitude 4px
        final double offsetY = 4 * (1 + -1 * (1 - (2 * _controller.value)).abs());
        return Transform.translate(
          offset: Offset(0, offsetY),
          child: child,
        );
      },
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AquaTooltip(
            message: widget.message,
            onLeadingIconTap: widget.onLeadingIconTap,
            onTrailingIconTap: widget.onTrailingIconTap,
            backgroundColor: widget.backgroundColor,
            foregroundColor: widget.foregroundColor,
            trailingIconColor: widget.trailingIconColor,
            isDismissible: widget.isDismissible,
            isInfo: widget.isInfo,
            leadingIcon: widget.leadingIcon,
            margin: widget.margin,
            trailingIcon: widget.trailingIcon,
          ),
          Transform.translate(
            offset: const Offset(0, -1),
            child: Center(
              child: SvgPicture.asset(
                'assets/icons/pointer.svg',
                width: 18,
                height: 10,
                colorFilter: ColorFilter.mode(pointerColor, BlendMode.srcIn),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
