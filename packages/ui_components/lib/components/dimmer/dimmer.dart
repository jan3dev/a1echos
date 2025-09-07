import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';

class AquaDimmer extends StatelessWidget {
  const AquaDimmer({
    super.key,
    this.child,
    this.colors,
  });

  final Widget? child;
  final AquaColors? colors;

  @override
  Widget build(BuildContext context) {
    // Create overlay color with 4% opacity
    final overlayColor = Theme.of(context).brightness == Brightness.dark
        ? Colors.black.withOpacity(0.04)
        : Colors.white.withOpacity(0.04);

    return SizedBox(
      width: double.infinity,
      height: double.infinity,
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
        child: Container(
          color: overlayColor,
          child: child,
        ),
      ),
    );
  }

  static void show(
    BuildContext context, {
    Widget? child,
    AquaColors? colors,
  }) {
    showDialog(
      context: context,
      useRootNavigator: true,
      barrierColor: Colors.transparent,
      builder: (context) => AquaDimmer(
        colors: colors,
        child: child,
      ),
    );
  }
}
