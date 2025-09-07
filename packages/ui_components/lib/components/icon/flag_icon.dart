import 'package:flutter/material.dart';
import 'package:flutter_svg/svg.dart';

class FlagIcon extends StatelessWidget {
  const FlagIcon(
    this.countryCode, {
    super.key,
    this.size = 24.0,
  });

  final String countryCode;
  final double size;

  @override
  Widget build(BuildContext context) {
    return SvgPicture.asset(
      'assets/svgs/flags/$countryCode.svg',
      width: size,
      height: size,
    );
  }
}
