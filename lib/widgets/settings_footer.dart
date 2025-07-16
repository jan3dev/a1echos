import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:ui_components/ui_components.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../constants/app_constants.dart';
import '../providers/theme_provider.dart';
import '../models/app_theme.dart';

class SettingsFooter extends ConsumerStatefulWidget {
  const SettingsFooter({super.key});

  @override
  ConsumerState<SettingsFooter> createState() => _SettingsFooterState();
}

class _SettingsFooterState extends ConsumerState<SettingsFooter> {
  String _version = '';

  @override
  void initState() {
    super.initState();
    _loadVersion();
  }

  Future<void> _loadVersion() async {
    final info = await PackageInfo.fromPlatform();
    setState(() {
      _version = 'App Version ${info.version} (${info.buildNumber})';
    });
  }

  @override
  Widget build(BuildContext context) {
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = selectedTheme.colors(context);
    final tags = ['@Echos', '@A1Lab', '@JAN3'];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Center(
            child: SvgPicture.asset(
              'assets/icons/footer-logo.svg',
              width: 80,
              height: 40,
              colorFilter: ColorFilter.mode(
                colors.textPrimary,
                BlendMode.srcIn,
              ),
            ),
          ),
          const SizedBox(height: 16),
          Divider(
            height: 1,
            thickness: 1,
            color: colors.surfaceBorderSecondary,
          ),
          const SizedBox(height: 16),
          Text(
            AppStrings.followUs,
            style: AquaTypography.body2Medium.copyWith(
              color: colors.textTertiary,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: tags
                .map(
                  (tag) => Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text(
                      tag,
                      style: AquaTypography.body2SemiBold.copyWith(
                        color: colors.textPrimary,
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 16),
          Divider(
            height: 1,
            thickness: 1,
            color: colors.surfaceBorderSecondary,
          ),
          const SizedBox(height: 16),
          Text(
            _version,
            style: AquaTypography.caption1Medium.copyWith(
              color: colors.textTertiary,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
