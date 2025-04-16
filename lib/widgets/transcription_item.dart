import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/transcription.dart';
import '../providers/transcription_provider.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

class TranscriptionItem extends StatelessWidget {
  final Transcription transcription;
  
  const TranscriptionItem({
    super.key,
    required this.transcription,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dateFormat = DateFormat('MMM d, h:mm a');
    
    // Split the text by paragraph breaks
    final paragraphs = transcription.text.split('\n\n');
    
    return Dismissible(
      key: Key(transcription.id),
      background: Container(
        color: Colors.red,
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20.0),
        child: const Icon(
          Icons.delete,
          color: Colors.white,
        ),
      ),
      direction: DismissDirection.endToStart,
      onDismissed: (_) {
        Provider.of<TranscriptionProvider>(context, listen: false)
            .deleteTranscription(transcription.id);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Transcription deleted'),
            duration: Duration(seconds: 2),
          ),
        );
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Timestamp header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: Text(
              dateFormat.format(transcription.timestamp),
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
              ),
            ),
          ),
          
          // Chat-like bubbles for each paragraph
          ...paragraphs.map((paragraph) => 
            GestureDetector(
              onLongPress: () => _copyToClipboard(context, paragraph),
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: theme.colorScheme.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(
                  paragraph,
                  style: theme.textTheme.bodyMedium,
                ),
              ),
            )
          ),
          
          const SizedBox(height: 8),
          const Divider(),
        ],
      ),
    );
  }

  void _copyToClipboard(BuildContext context, String text) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Copied to clipboard'),
        duration: Duration(seconds: 2),
      ),
    );
  }
} 