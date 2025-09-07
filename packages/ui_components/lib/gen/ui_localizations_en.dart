// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'ui_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class UiLocalizationsEn extends UiLocalizations {
  UiLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get sent => 'Sent';

  @override
  String get received => 'Received';

  @override
  String get swapped => 'Swapped';

  @override
  String get sending => 'Sending';

  @override
  String get receiving => 'Receiving';

  @override
  String get swapping => 'Swapping';

  @override
  String get failed => 'Failed';

  @override
  String get refund => 'Refund';

  @override
  String get insufficientFunds => 'Insufficient funds';

  @override
  String get addFunds => 'Add funds';

  @override
  String get onChain => 'On-chain';

  @override
  String get lBtc => 'L-BTC';

  @override
  String get lUsdt => 'L-USDt';

  @override
  String get swappedFromLUsdt => 'Swapped from L-USDt';

  @override
  String get swappedToLBtc => 'Swapped to L-BTC';

  @override
  String get tapForOptions => 'Tap for options';

  @override
  String get swappedFromLBtc => 'Swapped from L-BTC';

  @override
  String get swappedToLUsdt => 'Swapped to L-USDt';

  @override
  String balanceValue(String balance) {
    return 'Balance: $balance';
  }

  @override
  String get reloadable => 'Reloadable';

  @override
  String get expiryDate => 'Expiry Date';

  @override
  String get cvv => 'CVV';

  @override
  String get nonReloadable => 'Non-Reloadable';

  @override
  String get bitcoinPrice => 'Bitcoin Price';

  @override
  String get totalBalance => 'Total Balance';

  @override
  String get receive => 'Receive';

  @override
  String get send => 'Send';

  @override
  String get scan => 'Scan';

  @override
  String get from => 'From';

  @override
  String get to => 'To';

  @override
  String get copiedToClipboard => 'Copied to clipboard';

  @override
  String get bestOffer => 'Best Offer';

  @override
  String get generateNewAddress => 'Generate New Address';

  @override
  String get share => 'Share';

  @override
  String get copyAddress => 'Copy Address';

  @override
  String get failedToShareQrImage => 'Failed to share QR image';

  @override
  String onlyForAsset(String asset) {
    return 'Only for $asset';
  }

  @override
  String get singleUseAddress => 'Single Use Address';

  @override
  String expOrderExpireDate(String orderExpiresatFormatfulldate) {
    return 'Exp: $orderExpiresatFormatfulldate';
  }

  @override
  String get swapServiceFee => 'Swap Service Fee';

  @override
  String get usdtSentHereIsSwappedToLiquidUsdt =>
      'USDt sent here is swapped to Liquid USDt.';
}
