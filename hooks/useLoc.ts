export const useLoc = () => {
  return {
    loc: {
      sessionRenameTitle: 'Rename',
      delete: 'Delete',
      modifiedPrefix: 'Modified',
      createdPrefix: 'Created',
      save: 'Save',
      cancel: 'Cancel',
      edit: 'Edit',
      sessionNameLabel: 'Session Name',
      sessionNameMaxLengthHelper: 'Max 30 characters.',
      homeDeleteSelectedSessionsTitle: 'Delete Selected Sessions?',
      homeDeleteSelectedSessionsMessage: (count: number) =>
        `This action cannot be undone.`,
      homeSessionsDeleted: (count: number) => `Session deleted`,
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
    },
  };
};
