// ignore_for_file: unused_element

import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:ui_components/gen/assets.gen.dart';

const _defaultSize = 24.0;
const _minTouchTarget = 44.0;

typedef AquaIconBuilder = AquaIcon Function({
  Color? color,
  Key? key,
  VoidCallback? onTap,
  EdgeInsets? padding,
  double size,
  bool enforceMinTouchTarget,
});

class AquaIcon extends StatelessWidget {
  const AquaIcon._({
    required this.asset,
    // ignore: unused_element_parameter
    this.color,
    // ignore: unused_element_parameter
    this.onTap,
    // ignore: unused_element_parameter
    this.padding,
    // ignore: unused_element_parameter
    this.enforceMinTouchTarget = true,
  }) : size = _defaultSize;

  AquaIcon.arrowLeft({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.arrowLeft;
  AquaIcon.arrowUp({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.arrowUp;
  AquaIcon.arrowRight({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.arrowRight;
  AquaIcon.arrowDown({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.arrowDown;
  AquaIcon.arrowDownRight({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.arrowDownRight;
  AquaIcon.arrowDownLeft({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.arrowDownLeft;
  AquaIcon.arrowUpLeft({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.arrowUpLeft;
  AquaIcon.arrowUpRight({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.arrowUpRight;
  AquaIcon.chevronDown({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.chevronDown;
  AquaIcon.chevronLeft({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.chevronLeft;
  AquaIcon.chevronUp({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.chevronUp;
  AquaIcon.chevronRight({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.chevronRight;
  AquaIcon.star({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.star;
  AquaIcon.starFilled({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.starFilled;
  AquaIcon.caret({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.caret;
  AquaIcon.check({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.check;
  AquaIcon.pending({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.pending;

  AquaIcon.notification({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.notification;
  AquaIcon.notificationIndicator({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.notificationIndicator;
  AquaIcon.eyeOpen({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.eyeOpen;
  AquaIcon.eyeClose({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.eyeClose;
  AquaIcon.swap({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.swap;
  AquaIcon.swapVertical({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.swapVertical;
  AquaIcon.scan({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.scan;
  AquaIcon.filter({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.filter;
  AquaIcon.paste({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.paste;
  AquaIcon.danger({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.danger;
  AquaIcon.wallet({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.wallet;
  AquaIcon.hardwareWallet({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.hardwareWallet;
  AquaIcon.aquaIcon({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.aquaIcon;
  AquaIcon.refresh({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.refresh;
  AquaIcon.warning({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.warning;
  AquaIcon.marketplace({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.marketplace;
  AquaIcon.export({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.export;
  AquaIcon.remove({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.remove;
  AquaIcon.images({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.images;
  AquaIcon.settings({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.settings;
  AquaIcon.edit({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.edit;
  AquaIcon.externalLink({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.externalLink;
  AquaIcon.image({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.image;
  AquaIcon.account({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.account;
  AquaIcon.fees({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.fees;
  AquaIcon.lightbulb({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.lightbulb;
  AquaIcon.plus({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.plus;
  AquaIcon.close({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.close;
  AquaIcon.checkCircle({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.checkCircle;
  AquaIcon.logout({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.logout;
  AquaIcon.minus({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.minus;
  AquaIcon.infoCircle({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.infoCircle;
  AquaIcon.more({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.more;
  AquaIcon.language({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.language;
  AquaIcon.history({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.history;
  AquaIcon.share({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.share;
  AquaIcon.rotate({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.rotate;
  AquaIcon.referenceRate({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.referenceRate;
  AquaIcon.spinnerLoading({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.spinnerLoading;
  AquaIcon.box({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.box;
  AquaIcon.map({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.map;
  AquaIcon.theme({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.theme;
  AquaIcon.copy({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.copy;
  AquaIcon.key({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.key;
  AquaIcon.globe({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.globe;
  AquaIcon.biometricFingerprint({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.biometricFingerprint;
  AquaIcon.pokerchip({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.pokerchip;
  AquaIcon.assets({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.assets;
  AquaIcon.pegIn({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.pegIn;
  AquaIcon.passcode({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.passcode;
  AquaIcon.qrIcon({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.qrIcon;
  AquaIcon.experimental({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.experimental;
  AquaIcon.shield({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.shield;
  AquaIcon.helpSupport({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.helpSupport;
  AquaIcon.redo({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.redo;
  AquaIcon.home({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.home;
  AquaIcon.chart({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.chart;
  AquaIcon.tool({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.tool;
  AquaIcon.upload({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.upload;
  AquaIcon.user({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.user;
  AquaIcon.search({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.search;
  AquaIcon.sidebarVisibilityLeft({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.sidebarVisibilityLeft;
  AquaIcon.sidebarVisibilityRight({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.sidebarVisibilityRight;
  AquaIcon.creditCard({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.creditCard;
  AquaIcon.hamburger({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.hamburger;
  AquaIcon.grab({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.grab;
  AquaIcon.trendUp({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.trendUp;
  AquaIcon.statusSuccess({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.statusSuccess;
  AquaIcon.statusWarning({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.statusWarning;
  AquaIcon.statusDanger({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.statusDanger;
  AquaIcon.statusNeutral({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.statusNeutral;
  AquaIcon.lock({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.lock;
  AquaIcon.trash({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.trash;
  AquaIcon.selectAll({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.selectAll;
  AquaIcon.copyMultiple({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.copyMultiple;
  AquaIcon.web({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.web;
  AquaIcon.addAlert({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.addAlert;
  AquaIcon.bank({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.bank;
  AquaIcon.bitcoinGeneric({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.bitcoinGeneric;
  AquaIcon.boltAlt({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.boltAlt;
  AquaIcon.btcpayServer({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.btcpayServer;
  AquaIcon.calendar({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.calendar;
  AquaIcon.chevronUpDown({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.chevronUpDown;
  AquaIcon.circularProgress({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.circularProgress;
  AquaIcon.contractCheck({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.contractCheck;
  AquaIcon.contractSearch({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.contractSearch;
  AquaIcon.crossing({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.crossing;
  AquaIcon.crossingDown({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.crossingDown;
  AquaIcon.crossingUp({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.crossingUp;
  AquaIcon.documentLayoutLeft({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.documentLayoutLeft;
  AquaIcon.echosIcon({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.echosIcon;
  AquaIcon.echosLogo({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.echosLogo;
  AquaIcon.faq({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.faq;
  AquaIcon.ghost({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.ghost;
  AquaIcon.gift({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.gift;
  AquaIcon.heart({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.heart;
  AquaIcon.heartFilled({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.heartFilled;
  AquaIcon.incognito({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.incognito;
  AquaIcon.instagramLogo({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.instagramLogo;
  AquaIcon.jan3Logo({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.jan3Logo;
  AquaIcon.linkedin({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.linkedin;
  AquaIcon.list({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.list;
  AquaIcon.loans({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.loans;
  AquaIcon.mic({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.mic;
  AquaIcon.p2p({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.p2p;
  AquaIcon.paragraph({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.paragraph;
  AquaIcon.switchIcon({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.switchIcon;
  AquaIcon.telegramLogo({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.telegramLogo;
  AquaIcon.unlink({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.unlink;
  AquaIcon.xLogo({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.xLogo;
  AquaIcon.zendesk({
    super.key,
    this.color,
    this.onTap,
    this.padding,
    this.size = _defaultSize,
    this.enforceMinTouchTarget = true,
  }) : asset = AquaUiAssets.svgs.zendesk;

  final SvgGenImage asset;
  final double size;
  final Color? color;
  final EdgeInsets? padding;
  final VoidCallback? onTap;
  final bool enforceMinTouchTarget;

  @override
  Widget build(BuildContext context) {
    final EdgeInsets effectivePadding;
    if (onTap != null && enforceMinTouchTarget) {
      // Calculate padding needed to reach minimum touch target
      final minPadding = math.max(0.0, (_minTouchTarget - size) / 2);
      if (padding != null) {
        // Ensure custom padding meets minimum requirements
        effectivePadding = EdgeInsets.only(
          left: math.max(padding!.left, minPadding),
          top: math.max(padding!.top, minPadding),
          right: math.max(padding!.right, minPadding),
          bottom: math.max(padding!.bottom, minPadding),
        );
      } else {
        effectivePadding = EdgeInsets.all(minPadding);
      }
    } else if (padding != null) {
      // Use custom padding if explicitly provided and enforcement is off
      effectivePadding = padding!;
    } else if (onTap != null) {
      // Default padding for interactive icons without enforcement
      effectivePadding = const EdgeInsets.all(4);
    } else {
      // No padding for non-interactive icons
      effectivePadding = EdgeInsets.zero;
    }

    return Container(
      alignment: Alignment.center,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(100),
        splashFactory: InkSparkle.splashFactory,
        overlayColor: WidgetStateProperty.resolveWith((state) {
          if (state.contains(WidgetState.hovered) &&
              !state.contains(WidgetState.pressed)) {
            return Colors.transparent;
          }
          return null;
        }),
        child: Ink(
          padding: effectivePadding,
          child: asset.svg(
            width: size.toDouble(),
            height: size.toDouble(),
            colorFilter: color != null
                ? ColorFilter.mode(color!, BlendMode.srcIn)
                : null,
          ),
        ),
      ),
    );
  }
}
