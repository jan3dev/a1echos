import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import '../models/transcription.dart';

/// Service for sharing transcriptions using native platform sharing
class ShareService {
  /// Shares a list of transcriptions using the native share dialog
  static Future<ShareResult> shareTranscriptions(
    List<Transcription> transcriptions, {
    Rect? sharePositionOrigin,
  }) async {
    if (transcriptions.isEmpty) {
      throw ArgumentError('Cannot share empty transcription list');
    }

    final content = formatTranscriptions(transcriptions);

    final params = ShareParams(
      text: content,
      sharePositionOrigin: sharePositionOrigin,
    );

    return await SharePlus.instance.share(params);
  }

  /// Formats transcriptions for sharing
  static String formatTranscriptions(List<Transcription> transcriptions) {
    if (transcriptions.isEmpty) {
      return '';
    }

    final buffer = StringBuffer();

    for (int i = 0; i < transcriptions.length; i++) {
      final transcription = transcriptions[i];

      buffer.write(transcription.text);

      if (i < transcriptions.length - 1) {
        buffer.writeln();
        buffer.writeln();
      }
    }

    return buffer.toString();
  }
}
