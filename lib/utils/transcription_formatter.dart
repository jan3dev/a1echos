import '../constants/app_constants.dart';

class TranscriptionFormatter {
  /// Formats raw transcription text into paragraphs.
  static String format(String text) {
    if (text.isEmpty) return text;

    String normalizedText = text.trim().replaceAll(RegExp(r'\s+'), ' ');

    // If there are no sentence-ending punctuation marks, split into fixed-size paragraphs
    if (!RegExp(r'[.?!]').hasMatch(normalizedText)) {
      final words = normalizedText.split(' ');
      final List<String> paras = [];
      for (int i = 0; i < words.length; i += AppConstants.wordsPerParagraph) {
        final end =
            (i + AppConstants.wordsPerParagraph < words.length)
                ? i + AppConstants.wordsPerParagraph
                : words.length;
        paras.add(words.sublist(i, end).join(' '));
      }
      return paras.join('\n\n');
    }

    // Split by sentences, then group sentences into paragraphs of up to 3 sentences
    final List<String> sentences = [];
    String currentSentence = '';
    for (int i = 0; i < normalizedText.length; i++) {
      currentSentence += normalizedText[i];
      if ((normalizedText[i] == '.' ||
              normalizedText[i] == '!' ||
              normalizedText[i] == '?') &&
          (i == normalizedText.length - 1 || normalizedText[i + 1] == ' ')) {
        sentences.add(currentSentence.trim());
        currentSentence = '';
      }
    }
    if (currentSentence.trim().isNotEmpty) {
      sentences.add(currentSentence.trim());
    }

    final List<String> paragraphs = [];
    for (
      int i = 0;
      i < sentences.length;
      i += AppConstants.sentencesPerParagraph
    ) {
      final int end =
          i + AppConstants.sentencesPerParagraph < sentences.length
              ? i + AppConstants.sentencesPerParagraph
              : sentences.length;
      final paragraph = sentences.sublist(i, end).join(' ');
      paragraphs.add(paragraph);
    }

    return paragraphs.join('\n\n');
  }
}
