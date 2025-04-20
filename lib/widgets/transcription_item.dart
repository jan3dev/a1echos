import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/transcription.dart';
import '../providers/local_transcription_provider.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../constants/app_constants.dart';

class TranscriptionItem extends StatelessWidget {
  final Transcription transcription;

  const TranscriptionItem({super.key, required this.transcription});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dateFormat = DateFormat('MMM d, h:mm a');
    final paragraphs = transcription.text.split('\n\n');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          child: Text(
            dateFormat.format(transcription.timestamp),
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
            ),
          ),
        ),

        ...paragraphs.asMap().entries.map((entry) {
          final int index = entry.key;
          final String paragraph = entry.value;
          final String uniqueKey =
              '${transcription.id}_${index}_${paragraph.hashCode}';

          return Dismissible(
            key: Key(uniqueKey),
            background: Container(
              color: Colors.red,
              alignment: Alignment.centerRight,
              padding: const EdgeInsets.only(right: 20.0),
              child: const Icon(Icons.delete, color: Colors.white),
            ),
            direction: DismissDirection.endToStart,
            onDismissed: (direction) async {
              try {
                await Provider.of<LocalTranscriptionProvider>(
                  context,
                  listen: false,
                ).deleteParagraphFromTranscription(transcription.id, index);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(AppStrings.paragraphDeleted),
                      duration: AppConstants.snackBarDurationShort,
                    ),
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(AppStrings.paragraphDeleteFailed),
                      duration: AppConstants.snackBarDurationShort,
                    ),
                  );
                }
              }
            },
            child: GestureDetector(
              onLongPress: () => _copyToClipboard(context, paragraph),
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: theme.colorScheme.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(paragraph, style: theme.textTheme.bodyMedium),
              ),
            ),
          );
        }),

        const SizedBox(height: 8),

        const Divider(),
      ],
    );
  }

  void _copyToClipboard(BuildContext context, String text) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(AppStrings.copiedToClipboard),
        duration: AppConstants.snackBarDurationShort,
      ),
    );
  }
}
