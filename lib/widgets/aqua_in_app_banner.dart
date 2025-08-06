import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../providers/theme_provider.dart';
import '../models/app_theme.dart';
import '../logger.dart';

class AquaInAppBanner extends ConsumerWidget {
  const AquaInAppBanner({super.key});

  Future<void> _launchAquaApp() async {
    try {
      final Uri url = Uri.parse(
        Platform.isAndroid
            ? 'https://play.google.com/store/apps/details?id=io.aquawallet.android'
            : 'https://apps.apple.com/us/app/aqua-wallet/id6468594241',
      );

      if (await canLaunchUrl(url)) {
        final launched = await launchUrl(
          url,
          mode: LaunchMode.externalApplication,
        );
        if (!launched) {
          await launchUrl(url, mode: LaunchMode.platformDefault);
        }
      } else {
        logger.warning('Cannot launch URL: $url');
      }
    } catch (e, st) {
      logger.error(
        e,
        stackTrace: st,
        flag: FeatureFlag.ui,
        message: 'Error launching AQUA app URL',
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedTheme = ref.watch(prefsProvider).selectedTheme;
    final colors = selectedTheme.colors(context);

    return GestureDetector(
      onTap: _launchAquaApp,
      child: Container(
        width: double.infinity,
        height: 211,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          boxShadow: [
            BoxShadow(
              color: colors.surfaceInverse.withOpacity(0.04),
              blurRadius: 16,
              offset: const Offset(0, 0),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Image.asset('assets/icons/in-app-banner.png', fit: BoxFit.cover),
      ),
    );
  }
}
