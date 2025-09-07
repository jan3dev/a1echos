import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:ui_components/ui_components.dart';
import 'package:ui_components_playground/shared/shared.dart';

import '../providers/providers.dart';

class IconDemoPage extends HookConsumerWidget {
  const IconDemoPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = ref.watch(prefsProvider).selectedTheme;
    return Column(children: [
      _GeneralIconDemoSection(colors: theme.colors),
    ]);
  }
}

class _GeneralIconDemoSection extends StatelessWidget {
  const _GeneralIconDemoSection({required this.colors});

  final AquaColors colors;

  static const _sizes = [24.0, 18.0, 16.0, 12.0];
  static final _icons = [
    AquaIcon.arrowDown,
    AquaIcon.arrowLeft,
    AquaIcon.arrowUp,
    AquaIcon.arrowRight,
    AquaIcon.arrowDownRight,
    AquaIcon.arrowDownLeft,
    AquaIcon.arrowUpLeft,
    AquaIcon.arrowUpRight,
    AquaIcon.chevronDown,
    AquaIcon.chevronLeft,
    AquaIcon.chevronUp,
    AquaIcon.chevronRight,
    AquaIcon.star,
    AquaIcon.starFilled,
    AquaIcon.caret,
    AquaIcon.check,
    AquaIcon.pending,
    AquaIcon.notification,
    AquaIcon.notificationIndicator,
    AquaIcon.scan,
    AquaIcon.wallet,
    AquaIcon.eyeOpen,
    AquaIcon.eyeClose,
    AquaIcon.filter,
    AquaIcon.aquaIcon,
    AquaIcon.swap,
    AquaIcon.swapVertical,
    AquaIcon.paste,
    AquaIcon.refresh,
    AquaIcon.danger,
    AquaIcon.warning,
    AquaIcon.marketplace,
    AquaIcon.settings,
    AquaIcon.plus,
    AquaIcon.export,
    AquaIcon.edit,
    AquaIcon.account,
    AquaIcon.close,
    AquaIcon.remove,
    AquaIcon.externalLink,
    AquaIcon.fees,
    AquaIcon.checkCircle,
    AquaIcon.minus,
    AquaIcon.image,
    AquaIcon.lightbulb,
    AquaIcon.logout,
    AquaIcon.infoCircle,
    AquaIcon.share,
    AquaIcon.box,
    AquaIcon.key,
    AquaIcon.more,
    AquaIcon.rotate,
    AquaIcon.map,
    AquaIcon.globe,
    AquaIcon.language,
    AquaIcon.referenceRate,
    AquaIcon.theme,
    AquaIcon.biometricFingerprint,
    AquaIcon.passcode,
    AquaIcon.shield,
    AquaIcon.chart,
    AquaIcon.pokerchip,
    AquaIcon.qrIcon,
    AquaIcon.helpSupport,
    AquaIcon.assets,
    AquaIcon.experimental,
    AquaIcon.redo,
    AquaIcon.creditCard,
    AquaIcon.hamburger,
    AquaIcon.grab,
    AquaIcon.tool,
    AquaIcon.search,
    AquaIcon.trendUp,
    AquaIcon.sidebarVisibilityLeft,
    AquaIcon.sidebarVisibilityRight,
    AquaIcon.selectAll,
    AquaIcon.copyMultiple,
    AquaIcon.btcpayServer,
    AquaIcon.telegramLogo,
    AquaIcon.unlink,
    AquaIcon.addAlert,
    AquaIcon.bank,
    AquaIcon.bitcoinGeneric,
    AquaIcon.boltAlt,
    AquaIcon.calendar,
    AquaIcon.checkboxSelected,
    AquaIcon.checkboxUnselected,
    AquaIcon.checkboxUnselectedSmall,
    AquaIcon.chevronUpDown,
    AquaIcon.circularProgress,
    AquaIcon.contextualIcon24,
    AquaIcon.contextualIcon40,
    AquaIcon.contractCheck,
    AquaIcon.contractSearch,
    AquaIcon.crossing,
    AquaIcon.crossingDown,
    AquaIcon.crossingUp,
    AquaIcon.documentLayoutLeft,
    AquaIcon.echosIcon,
    AquaIcon.echosLogo,
    AquaIcon.faq,
    AquaIcon.ghost,
    AquaIcon.gift,
    AquaIcon.heart,
    AquaIcon.heartFilled,
    AquaIcon.incognito,
    AquaIcon.instagramLogo,
    AquaIcon.jan3Logo,
    AquaIcon.linkedin,
    AquaIcon.list,
    AquaIcon.loans,
    AquaIcon.mic,
    AquaIcon.p2p,
    AquaIcon.paragraph,
    AquaIcon.radioSelected,
    AquaIcon.radioUnselected,
    AquaIcon.radioSelectedSmall,
    AquaIcon.radioUnselectedSmall,
    AquaIcon.switchIcon,
    AquaIcon.telegramLogo,
    AquaIcon.unlink,
    AquaIcon.xLogo,
    AquaIcon.zendesk,
  ];

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: _icons.length,
      itemBuilder: (context, index) => IterationsBuilder(
        sizes: _sizes,
        scrollDirection: Axis.horizontal,
        onBuild: (size) => _icons[index](
          size: size,
          color: colors.textPrimary,
          onTap: () {},
        ),
      ),
    );
  }
}

class IterationsBuilder extends StatelessWidget {
  const IterationsBuilder({
    super.key,
    required this.sizes,
    required this.onBuild,
    this.scrollDirection = Axis.horizontal,
    this.physics = const NeverScrollableScrollPhysics(),
    this.shrinkWrap = true,
    this.compact = false,
    this.separatorSize = 20,
    limit = 0,
  }) : limit = limit > 0
            ? limit
            : sizes.length > 3
                ? 3
                : sizes.length;

  final List<double> sizes;
  final Widget Function(double size) onBuild;
  final Axis scrollDirection;
  final ScrollPhysics physics;
  final bool shrinkWrap;
  final bool compact;
  final double separatorSize;
  final int limit;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: scrollDirection == Axis.vertical ? 24 : 282,
      height: scrollDirection == Axis.vertical
          ? null
          : compact
              ? 58
              : 88,
      alignment: Alignment.center,
      child: ListView.separated(
        shrinkWrap: shrinkWrap,
        scrollDirection: scrollDirection,
        itemCount: limit,
        physics: physics,
        padding: EdgeInsets.zero,
        separatorBuilder: (context, index) => SizedBox(
          width: scrollDirection == Axis.horizontal ? separatorSize : 0,
          height: scrollDirection == Axis.vertical ? separatorSize : 0,
        ),
        itemBuilder: (_, index) => onBuild(sizes.take(limit).toList()[index]),
      ),
    );
  }
}
