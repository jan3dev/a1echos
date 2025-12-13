import { logger, mapConsoleTransport } from 'react-native-logs';

export enum FeatureFlag {
  recording = 'RECORDING',
  transcription = 'TRANSCRIPTION',
  session = 'SESSION',
  settings = 'SETTINGS',
  model = 'MODEL',
  storage = 'STORAGE',
  ui = 'UI',
  service = 'SERVICE',
  store = 'STORE',
  general = 'GENERAL',
}

const config = {
  levels: {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  },
  severity: __DEV__ ? 'debug' : 'error',
  transport: mapConsoleTransport,
  transportOptions: {
    mapLevels: {
      debug: 'log',
      info: 'info',
      warn: 'warn',
      error: 'error',
    },
  },
  async: true,
  dateFormat: 'time' as const,
  printLevel: true,
  printDate: true,
};

export const LOG = logger.createLogger(config);

const extendedLoggers = new Map<FeatureFlag, ReturnType<typeof LOG.extend>>();

export const logFor = (flag: FeatureFlag) => {
  let ext = extendedLoggers.get(flag);
  if (!ext) {
    ext = LOG.extend(flag);
    extendedLoggers.set(flag, ext);
  }
  return ext;
};

interface LogOptions {
  flag?: FeatureFlag;
  message?: string;
}

export const logDebug = (msg: string, opts?: LogOptions) => {
  const log = opts?.flag ? logFor(opts.flag) : LOG;
  log.debug(msg);
};

export const logInfo = (msg: string, opts?: LogOptions) => {
  const log = opts?.flag ? logFor(opts.flag) : LOG;
  log.info(msg);
};

export const logWarn = (msg: string, opts?: LogOptions) => {
  const log = opts?.flag ? logFor(opts.flag) : LOG;
  log.warn(msg);
};

export const logError = (
  error: unknown,
  opts?: LogOptions & { stack?: string }
) => {
  const log = opts?.flag ? logFor(opts.flag) : LOG;
  const prefix = opts?.message ? `${opts.message}: ` : '';

  if (error instanceof Error) {
    log.error(`${prefix}${error.message}`);
    if (opts?.stack ?? error.stack) {
      log.error(opts?.stack ?? error.stack);
    }
  } else {
    log.error(`${prefix}${String(error)}`);
    if (opts?.stack) {
      log.error(opts.stack);
    }
  }
};
