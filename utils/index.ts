export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
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
  // Logic to show relative time if recent, or absolute date
  // For now, just return absolute date
  return formatDate(lastModified);
};
