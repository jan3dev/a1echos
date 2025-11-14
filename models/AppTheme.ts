export enum AppTheme {
  AUTO = 'auto',
  LIGHT = 'light',
  DARK = 'dark',
}

export const getThemeName = (theme: AppTheme): string => {
  switch (theme) {
    case AppTheme.AUTO:
      return 'auto';
    case AppTheme.LIGHT:
      return 'light';
    case AppTheme.DARK:
      return 'dark';
    default:
      return 'light';
  }
};

export const getThemeByName = (name: string): AppTheme => {
  switch (name) {
    case 'auto':
      return AppTheme.AUTO;
    case 'light':
      return AppTheme.LIGHT;
    case 'dark':
      return AppTheme.DARK;
    default:
      return AppTheme.LIGHT;
  }
};


