export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const isSameWeek = (a: Date, b: Date): boolean => {
  const getMonday = (d: Date): Date => {
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
  };
  const aMonday = getMonday(a);
  const bMonday = getMonday(b);
  return isSameDay(aMonday, bMonday) && a.getFullYear() === b.getFullYear();
};

export const formatSessionSubtitle = ({
  now,
  created,
  lastModified,
  modifiedPrefix,
}: {
  now: Date;
  created: Date;
  lastModified: Date;
  modifiedPrefix: string;
}): string => {
  let dateStr: string;

  if (isSameDay(now, lastModified)) {
    dateStr = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(lastModified);
  } else if (isSameWeek(now, lastModified)) {
    dateStr = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(
      lastModified
    );
  } else if (now.getFullYear() === lastModified.getFullYear()) {
    dateStr = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(lastModified);
  } else {
    dateStr = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(lastModified);
  }

  const isModified = lastModified.getTime() - created.getTime() > 1000;
  return isModified ? `${modifiedPrefix} ${dateStr}` : dateStr;
};

export { delay } from './delay';
export {
  FeatureFlag,
  LOG,
  logDebug,
  logError,
  logFor,
  logInfo,
  logWarn
} from './log';
export { formatTranscriptionText } from './TranscriptionFormatter';
export { createPcmStreamWriter } from './WavWriter';
export type { PcmStreamWriter } from './WavWriter';
export { iosPressed } from './ripple';

