import 'package:echos/utils/utils.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ui_components/ui_components.dart';

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
      icon: AquaIcon.ghost(color: colors.textInverse, size: 24),
      iconVariant: AquaModalSheetVariant.info,
      title: context.loc.incognitoExplainerTitle,
      message: context.loc.incognitoExplainerBody,
      primaryButtonText: context.loc.incognitoExplainerCta,
      onPrimaryButtonTap: onDismiss ?? () => Navigator.pop(context),
    );
  }
}
