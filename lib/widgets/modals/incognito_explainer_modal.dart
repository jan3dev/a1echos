import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/svg.dart';
import 'package:ui_components/ui_components.dart';

import '../../constants/app_constants.dart';
import '../../providers/theme_provider.dart';
import '../../models/app_theme.dart';

/// A helper class to display the Incognito Mode explainer modal sheet.
class IncognitoExplainerModal {
  static void show({
    required BuildContext context,
    required WidgetRef ref,
    VoidCallback? onDismiss,
  }) {
    final appTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = appTheme.colors(context);

    AquaModalSheet.show(
      context,
      colors: colors,
      icon: SvgPicture.asset(
        'assets/icons/ghost.svg',
        width: 24,
        height: 24,
        colorFilter: ColorFilter.mode(colors.textInverse, BlendMode.srcIn),
      ),
      iconVariant: AquaModalSheetVariant.success, // TODO: change to info
      title: AppStrings.incognitoExplainerTitle,
      message: AppStrings.incognitoExplainerBody,
      primaryButtonText: AppStrings.incognitoExplainerCta,
      onPrimaryButtonTap: onDismiss ?? () => Navigator.pop(context),
    );
  }
}
