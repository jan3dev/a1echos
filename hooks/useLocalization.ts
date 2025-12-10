import { useTranslation } from 'react-i18next';

export const useLocalization = () => {
  const { t } = useTranslation();

  return {
    t,
    loc: {
      sessionRenameTitle: t('sessionRenameTitle'),
      delete: t('delete'),
      modifiedPrefix: t('modifiedPrefix'),
      createdPrefix: t('createdPrefix'),
      save: t('save'),
      cancel: t('cancel'),
      edit: t('edit'),
      share: t('share'),
      sessionNameLabel: t('sessionNameLabel'),
      sessionNameMaxLengthHelper: t('sessionNameMaxLengthHelper'),
      homeDeleteSelectedSessionsTitle: t('homeDeleteSelectedSessionsTitle'),
      homeDeleteSelectedSessionsMessage: (count: number) =>
        t('homeDeleteSelectedSessionsMessage', { count }),
      homeSessionsDeleted: (count: number) =>
        t('homeSessionsDeleted', { count }),
      transcriptionCount: (count: number) => t('transcriptionCount', { count }),
      followUsOnX: t('followUs'),
      couldNotOpenLink: t('couldNotOpenLink'),
      incognitoModeTitle: t('incognitoModeTitle'),
      incognitoExplainerTitle: t('incognitoExplainerTitle'),
      incognitoExplainerBody: t('incognitoExplainerBody'),
      incognitoExplainerCta: t('incognitoExplainerCta'),
      errorPrefix: t('errorPrefix'),
      recordingPrefix: t('recordingPrefix'),
      retry: t('retry'),
      emptySessionsMessage: t('emptySessionsMessage'),
      homeMicrophoneDenied: t('microphoneAccessDeniedMessage'),
      homeMicrophonePermissionRequired: t(
        'microphoneAccessRequiredMessageAndroid'
      ),
      homeFailedStartRecording: t('homeFailedStartRecording'),
      homeErrorCreatingSession: (error: string) =>
        t('homeErrorCreatingSession', { error }),
      sessionDeleteTranscriptionsTitle: t('sessionDeleteTranscriptionsTitle'),
      sessionDeleteTranscriptionsMessage: (count: number) =>
        t('sessionDeleteTranscriptionsMessage', { count }),
      sessionTranscriptionsDeleted: (count: number) =>
        t('sessionTranscriptionsDeleted', { count }),
      allTranscriptionsCopied: t('allTranscriptionsCopied'),
      noTranscriptionsToCopy: t('noTranscriptionsToCopy'),
      copyFailed: (error: string) => t('copyFailed', { error }),
      shareFailed: (error: string) => t('shareFailed', { error }),
      noTranscriptionsSelectedToShare: t('noTranscriptionsSelectedToShare'),
      sessionNotFound: t('sessionNotFound'),
      settingsTitle: t('settingsTitle'),
      modelTitle: t('modelTitle'),
      themeTitle: t('themeTitle'),
      spokenLanguageTitle: t('spokenLanguageTitle'),
      auto: t('auto'),
      light: t('light'),
      dark: t('dark'),
      whisperModelRealtimeTitle: t('whisperModelRealtimeTitle'),
      whisperModelFileTitle: t('whisperModelFileTitle'),
      whisperModelSubtitle: t('whisperModelSubtitle'),
      modelDescription: t('modelDescription'),
      spokenLanguageDescription: t('spokenLanguageDescription'),
      recordingTooShort: t('recordingTooShort'),
      transcriptionFailed: t('transcriptionFailed'),
      failedToInitializeEngine: t('failedToInitializeEngine'),
    },
  };
};
