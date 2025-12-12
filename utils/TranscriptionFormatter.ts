import { AppConstants } from '@/constants';

export const formatTranscriptionText = (text: string): string => {
  if (!text || text.length === 0) return text;

  const normalizedText = text.trim().replace(/\s+/g, ' ');

  // If there are no sentence-ending punctuation marks, split into fixed-size paragraphs
  if (!/[.?!]/.test(normalizedText)) {
    const words = normalizedText.split(' ');
    const paras: string[] = [];
    for (let i = 0; i < words.length; i += AppConstants.WORDS_PER_PARAGRAPH) {
      const end =
        i + AppConstants.WORDS_PER_PARAGRAPH < words.length
          ? i + AppConstants.WORDS_PER_PARAGRAPH
          : words.length;
      paras.push(words.slice(i, end).join(' '));
    }
    return paras.join('\n\n');
  }

  // Split by sentences, then group sentences into paragraphs
  const sentences: string[] = [];
  let currentSentence = '';
  for (let i = 0; i < normalizedText.length; i++) {
    currentSentence += normalizedText[i];
    const char = normalizedText[i];
    if (
      (char === '.' || char === '!' || char === '?') &&
      (i === normalizedText.length - 1 || normalizedText[i + 1] === ' ')
    ) {
      sentences.push(currentSentence.trim());
      currentSentence = '';
    }
  }
  if (currentSentence.trim().length > 0) {
    sentences.push(currentSentence.trim());
  }

  const paragraphs: string[] = [];
  for (
    let i = 0;
    i < sentences.length;
    i += AppConstants.SENTENCES_PER_PARAGRAPH
  ) {
    const end =
      i + AppConstants.SENTENCES_PER_PARAGRAPH < sentences.length
        ? i + AppConstants.SENTENCES_PER_PARAGRAPH
        : sentences.length;
    const paragraph = sentences.slice(i, end).join(' ');
    paragraphs.push(paragraph);
  }

  return paragraphs.join('\n\n');
};
