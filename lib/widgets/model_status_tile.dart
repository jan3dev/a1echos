import 'package:flutter/material.dart';
import '../models/model_type.dart';

/// Shows the status of the selected transcription model and an optional retry button.
class ModelStatusTile extends StatelessWidget {
  final ModelType selectedModelType;
  final bool isModelReady;
  final String? error;
  final VoidCallback onRetry;

  const ModelStatusTile({
    super.key,
    required this.selectedModelType,
    required this.isModelReady,
    this.error,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final modelName =
        selectedModelType == ModelType.vosk
            ? 'Vosk (Small EN)'
            : 'Whisper (Base EN)';

    if (isModelReady) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.green.shade50,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.green.shade300),
        ),
        child: Row(
          children: [
            Icon(Icons.check_circle, color: Colors.green.shade700),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                '$modelName model is ready.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: Colors.green.shade900,
                ),
              ),
            ),
          ],
        ),
      );
    } else if (error != null) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.red.shade50,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.red.shade300),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.error, color: Colors.red.shade700),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$modelName model failed to initialize.',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: Colors.red.shade900,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    error!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: Colors.red.shade800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: onRetry,
                    child: const Text('Retry Initialization'),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    } else {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.blue.shade50,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.blue.shade300),
        ),
        child: Row(
          children: [
            const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Initializing $modelName model...',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: Colors.blue.shade900,
                ),
              ),
            ),
          ],
        ),
      );
    }
  }
}
