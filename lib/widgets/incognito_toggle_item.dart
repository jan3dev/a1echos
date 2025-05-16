import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:ui_components/ui_components.dart';
import '../providers/settings_provider.dart';
import '../constants/app_constants.dart';

class IncognitoToggleItem extends StatelessWidget {
  const IncognitoToggleItem({super.key});

  @override
  Widget build(BuildContext context) {
    final settingsProvider = Provider.of<SettingsProvider>(context);
    final colors = AquaColors.lightColors;

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 1),
      decoration: BoxDecoration(
        color: colors.surfacePrimary,
        borderRadius: BorderRadius.circular(8),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 16,
            offset: const Offset(0, 0),
          ),
        ],
      ),
      child: AquaListItem(
        title: AppStrings.incognitoModeToggleTitle,
        iconLeading: SvgPicture.asset(
          'assets/icons/incognito.svg',
          width: 24,
          height: 24,
          colorFilter: ColorFilter.mode(
            colors.textSecondary,
            BlendMode.srcIn,
          ),
        ),
        iconTrailing: AquaToggle(
          value: settingsProvider.isIncognitoMode,
          activeColor: colors.accentBrand,
          trackColor: colors.surfaceBorderSecondary,
          onChanged: (value) {
            settingsProvider.setIncognitoMode(value);
          },
        ),
        onTap: () {
          settingsProvider.setIncognitoMode(!settingsProvider.isIncognitoMode);
        },
        backgroundColor: Colors.transparent,
      ),
    );
  }
} 