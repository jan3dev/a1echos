import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';

class AquaCheckBox extends StatelessWidget {
  const AquaCheckBox({
    super.key,
    required this.value,
    this.onChanged,
    this.enabled = true,
  }) : size = AquaControlSize.large;

  const AquaCheckBox.small({
    super.key,
    required this.value,
    this.onChanged,
    this.enabled = true,
  }) : size = AquaControlSize.small;

  final bool value;
  final AquaControlSize size;
  final ValueChanged<bool>? onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final boxSize = size == AquaControlSize.large ? 24.0 : 18.0;
    final checkSize = size == AquaControlSize.large ? 18.0 : 16.0;
    final borderWidth = size == AquaControlSize.large ? 2.0 : 1.5;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        customBorder: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(4),
        ),
        onTap: enabled
            ? onChanged != null
                ? () => onChanged!(value)
                : null
            : null,
        child: Opacity(
          opacity: enabled ? 1 : 0.5,
          child: Container(
            width: boxSize,
            height: boxSize,
            decoration: BoxDecoration(
              color: value
                  ? Theme.of(context).colorScheme.primary
                  : isDark
                      ? Theme.of(context).colorScheme.surfaceContainerHigh
                      : const Color(0xFFF4F5F6),
              border: value
                  ? null
                  : Border.all(
                      color: isDark
                          ? Theme.of(context).colorScheme.outline
                          : const Color(0xFFE9EBEC),
                      width: borderWidth,
                    ),
              borderRadius:
                  BorderRadius.circular(size == AquaControlSize.large ? 4 : 3),
            ),
            child: value
                ? Icon(
                    Icons.check,
                    size: checkSize,
                    color: Colors.white,
                  )
                : null,
          ),
        ),
      ),
    );
  }
}
