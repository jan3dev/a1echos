export const useLocalization = () => {
  return {
    loc: {
      sessionRenameTitle: 'Rename',
      delete: 'Delete',
      modifiedPrefix: 'Modified',
      createdPrefix: 'Created',
      save: 'Save',
      cancel: 'Cancel',
      edit: 'Edit',
      share: 'Share',
      sessionNameLabel: 'Session Name',
      sessionNameMaxLengthHelper: 'Max 30 characters.',
      homeDeleteSelectedSessionsTitle: 'Delete Selected Sessions?',
      homeDeleteSelectedSessionsMessage: (count: number) =>
        `Delete ${count} session${
          count === 1 ? '' : 's'
        }? This action cannot be undone.`,
      homeSessionsDeleted: (count: number) =>
        `${count} Session${count === 1 ? '' : 's'} deleted`,
      transcriptionCount: (count: number) =>
        `${count} Transcription${count === 1 ? '' : 's'}`,
      // Settings Footer
      followUsOnX: 'Follow us on X',
      couldNotOpenLink: 'Could not open link',
      // Incognito Explainer Modal
      incognitoExplainerTitle: 'Incognito Mode',
      incognitoExplainerBody:
        "Transcribe without saving. This session won't be stored or synced anywhere.",
      incognitoExplainerCta: 'Got it!',
      // Error View
      errorPrefix: 'Error:',
      retry: 'Retry',
      // Home Screen
      emptySessionsMessage: 'Hit the record button to start transcribing',
      homeMicrophoneDenied:
        'Microphone access denied. Please enable it in Settings.',
      homeMicrophonePermissionRequired:
        'Microphone permission required to record.',
      homeFailedStartRecording: 'Failed to start recording',
      homeErrorCreatingSession: (error: string) =>
        `Failed to create session: ${error}`,
      // Session Detail Screen
      sessionDeleteTranscriptionsTitle: 'Delete Transcriptions?',
      sessionDeleteTranscriptionsMessage: (count: number) =>
        `Delete ${count} transcription${
          count === 1 ? '' : 's'
        }? This action cannot be undone.`,
      sessionTranscriptionsDeleted: (count: number) =>
        `${count} transcription${count === 1 ? '' : 's'} deleted`,
      allTranscriptionsCopied: 'All transcriptions copied',
      noTranscriptionsToCopy: 'No transcriptions to copy',
      copyFailed: (error: string) => `Failed to copy: ${error}`,
      shareFailed: (error: string) => `Failed to share: ${error}`,
      noTranscriptionsSelectedToShare: 'No transcriptions selected to share',
      sessionNotFound: 'Session not found',
      // Settings Screen
      settingsTitle: 'Settings',
      modelTitle: 'Model',
      themeTitle: 'Theme',
      spokenLanguageTitle: 'Spoken Language',
      auto: 'Auto',
      light: 'Light',
      dark: 'Dark',
      whisperModelRealtimeTitle: 'Whisper (Real-time)',
      whisperModelFileTitle: 'Whisper',
    },
  };
};
