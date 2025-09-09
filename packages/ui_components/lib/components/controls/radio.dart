import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';

class AquaRadio<T> extends StatelessWidget {
  const AquaRadio({
    super.key,
    required this.value,
    this.onChanged,
    this.groupValue,
    this.enabled = true,
  }) : size = AquaControlSize.large;

  const AquaRadio.small({
    super.key,
    required this.value,
    this.onChanged,
    this.groupValue,
    this.enabled = true,
  }) : size = AquaControlSize.small;

  final T value;
  final T? groupValue;
  final AquaControlSize size;
  final ValueChanged<T>? onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final isSelected = value == groupValue;
    final boxSize = size == AquaControlSize.large ? 24.0 : 18.0;
    final dotSize = size == AquaControlSize.large ? 10.0 : 7.5;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        customBorder: const CircleBorder(),
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
              color: Theme.of(context).colorScheme.surfaceContainerHigh,
              border: !isSelected
                  ? Border.all(
                      color: Theme.of(context).colorScheme.outlineVariant,
                      width: 2.0,
                    )
                  : null,
              shape: BoxShape.circle,
            ),
            child: isSelected
                ? Container(
                    width: boxSize,
                    height: boxSize,
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primary,
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Container(
                        width: dotSize,
                        height: dotSize,
                        decoration: BoxDecoration(
                          color: Theme.of(context)
                              .colorScheme
                              .surfaceContainerHigh,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                  )
                : null,
          ),
        ),
      ),
    );
  }
}
