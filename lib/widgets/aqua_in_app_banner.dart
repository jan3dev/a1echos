import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:ui_components/ui_components.dart';

class AquaInAppBanner extends StatelessWidget {
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
        if (kDebugMode) {
          debugPrint('Cannot launch URL: $url');
          debugPrint('This is expected behavior in iOS Simulator');
        }
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Error launching URL: $e');
        debugPrint(
          'This is expected behavior in iOS Simulator - URL launching is limited',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final aquaColors = AquaColors.lightColors;

    return GestureDetector(
      onTap: _launchAquaApp,
      child: Container(
        width: double.infinity,
        height: 211,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          boxShadow: [
            BoxShadow(
              color: aquaColors.surfaceInverse.withOpacity(0.04),
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
