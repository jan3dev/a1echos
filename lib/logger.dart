import 'package:talker_flutter/talker_flutter.dart';

/// Feature flags to tag log messages by domain.
enum FeatureFlag {
  recording,
  transcription,
  session,
  settings,
  model,
  storage,
  ui,
  service,
  provider,
  general,
}

/// A simple singleton wrapper around [Talker] that provides a minimal, uniform API for logging across the app.
class CustomLogger {
  CustomLogger._internal() {
    _talker = TalkerFlutter.init();
  }

  static final CustomLogger _instance = CustomLogger._internal();

  factory CustomLogger() => _instance;

  late final Talker _talker;

  Talker get raw => _talker;

  void debug(Object message, {FeatureFlag? flag}) =>
      _talker.debug(_prefix(message, flag));

  void info(Object message, {FeatureFlag? flag}) =>
      _talker.info(_prefix(message, flag));

  void warning(Object message, {FeatureFlag? flag}) =>
      _talker.warning(_prefix(message, flag));

  void error(
    Object error, {
    StackTrace? stackTrace,
    FeatureFlag? flag,
    String? message,
  }) {
    _talker.error(
      message != null ? _prefix(message, flag) : _prefix(error, flag),
      error,
      stackTrace,
    );
  }

  String _prefix(Object message, FeatureFlag? flag) {
    if (flag == null) return message.toString();
    return '[${flag.name.toUpperCase()}] $message';
  }
}

final CustomLogger logger = CustomLogger();
