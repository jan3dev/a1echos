import 'package:echos/l10n/app_localizations.dart';
import 'package:flutter/material.dart';

extension LocalizedBuildContext on BuildContext {
  AppLocalizations get loc {
    final localization = AppLocalizations.of(this);
    assert(
      localization != null,
      'AppLocalizations not found in context. Ensure that MaterialApp/FutureBuilder provides the correct localizationsDelegates.',
    );
    return localization!;
  }
}
