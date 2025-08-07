import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:ui_components/ui_components.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:echos/utils/utils.dart';
import '../providers/theme_provider.dart';
import '../models/app_theme.dart';

class SettingsFooter extends ConsumerStatefulWidget {
  const SettingsFooter({super.key});

  @override
  ConsumerState<SettingsFooter> createState() => _SettingsFooterState();
}

class _SettingsFooterState extends ConsumerState<SettingsFooter> {
  String _version = '';
  static const _tags = [
    {'tag': 'Echos', 'handle': 'a1echos'},
    {'tag': 'A1Lab', 'handle': 'a1laboratory'},
    {'tag': 'JAN3', 'handle': 'jan3com'},
  ];

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

  Future<void> _launchX(BuildContext context, String handle) async {
    final sanitized = handle.replaceFirst(RegExp(r'^@'), '');
    final url = Uri.https('x.com', sanitized);
    final messenger = ScaffoldMessenger.of(context);
    final ok = await launchUrl(url, mode: LaunchMode.externalApplication);
    if (!ok) {
      messenger.showSnackBar(
        const SnackBar(content: Text('Could not open link')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = selectedTheme.colors(context);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Center(
            child: SvgPicture.asset(
              'assets/icons/footer-logo.svg',
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
            context.loc.followUs,
            style: AquaTypography.body2Medium.copyWith(
              color: colors.textTertiary,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: _tags
                .map(
                  (tagData) => Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Semantics(
                      label: 'Open ${tagData['tag']} on X',
                      child: InkWell(
                        onTap: () => _launchX(context, tagData['handle']!),
                        child: Text(
                          tagData['tag']!,
                          style: AquaTypography.body2SemiBold.copyWith(
                            color: colors.textPrimary,
                          ),
                        ),
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
