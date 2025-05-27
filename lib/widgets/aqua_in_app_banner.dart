import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:ui_components/ui_components.dart';

class AquaInAppBanner extends StatelessWidget {
  const AquaInAppBanner({super.key});

  Future<void> _launchAquaApp() async {
    final Uri url = Uri.parse('https://play.google.com/store/apps/details?id=io.aquawallet.android');
    if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
      throw Exception('Could not launch $url');
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
        child: Image.asset(
          'assets/icons/in-app-banner.png',
          fit: BoxFit.cover,
        ),
      ),
    );
  }
} 