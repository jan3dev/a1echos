import {
  FeatureFlag,
  LOG,
  logDebug,
  logError,
  logFor,
  logInfo,
  logWarn,
} from './log';

describe('FeatureFlag', () => {
  it('has 10 members', () => {
    const values = Object.values(FeatureFlag);
    expect(values).toHaveLength(10);
  });

  it.each([
    ['recording', 'RECORDING'],
    ['transcription', 'TRANSCRIPTION'],
    ['session', 'SESSION'],
    ['settings', 'SETTINGS'],
    ['model', 'MODEL'],
    ['storage', 'STORAGE'],
    ['ui', 'UI'],
    ['service', 'SERVICE'],
    ['store', 'STORE'],
    ['general', 'GENERAL'],
  ] as const)('has %s = %s', (key, value) => {
    expect(FeatureFlag[key]).toBe(value);
  });
});

describe('logFor', () => {
  it('returns an extended logger', () => {
    const ext = logFor(FeatureFlag.recording);
    expect(ext).toBeDefined();
    expect(ext.debug).toBeDefined();
    expect(ext.info).toBeDefined();
    expect(ext.warn).toBeDefined();
    expect(ext.error).toBeDefined();
  });

  it('memoizes (same ref on repeat call)', () => {
    const ext1 = logFor(FeatureFlag.session);
    const ext2 = logFor(FeatureFlag.session);
    expect(ext1).toBe(ext2);
  });

  it('returns distinct loggers per flag', () => {
    logFor(FeatureFlag.ui);
    logFor(FeatureFlag.storage);
    // They could be the same mock object since extend returns a new mock each time,
    // but the calls should be distinct
    expect(LOG.extend).toHaveBeenCalledWith(FeatureFlag.ui);
    expect(LOG.extend).toHaveBeenCalledWith(FeatureFlag.storage);
  });
});

describe('logDebug', () => {
  it('calls LOG.debug when no flag provided', () => {
    logDebug('test message');
    expect(LOG.debug).toHaveBeenCalledWith('test message');
  });

  it('calls extended logger when flag provided', () => {
    const ext = logFor(FeatureFlag.recording);
    logDebug('test message', { flag: FeatureFlag.recording });
    expect(ext.debug).toHaveBeenCalledWith('test message');
  });
});

describe('logInfo', () => {
  it('calls LOG.info when no flag provided', () => {
    logInfo('info message');
    expect(LOG.info).toHaveBeenCalledWith('info message');
  });

  it('calls extended logger when flag provided', () => {
    const ext = logFor(FeatureFlag.session);
    logInfo('info message', { flag: FeatureFlag.session });
    expect(ext.info).toHaveBeenCalledWith('info message');
  });
});

describe('logWarn', () => {
  it('calls LOG.warn when no flag provided', () => {
    logWarn('warn message');
    expect(LOG.warn).toHaveBeenCalledWith('warn message');
  });
});

describe('logError', () => {
  it('logs Error message and stack', () => {
    const err = new Error('test error');
    err.stack = 'mock stack trace';
    logError(err);
    expect(LOG.error).toHaveBeenCalledWith('test error');
    expect(LOG.error).toHaveBeenCalledWith('mock stack trace');
  });

  it('logs string errors', () => {
    logError('string error');
    expect(LOG.error).toHaveBeenCalledWith('string error');
  });

  it('adds prefix via opts.message', () => {
    const err = new Error('fail');
    logError(err, { message: 'Context' });
    expect(LOG.error).toHaveBeenCalledWith('Context: fail');
  });

  it('uses opts.stack override over Error.stack', () => {
    const err = new Error('fail');
    err.stack = 'original stack';
    logError(err, { stack: 'custom stack' });
    expect(LOG.error).toHaveBeenCalledWith('custom stack');
  });

  it('logs stack from opts for string errors', () => {
    logError('string error', { stack: 'custom stack' });
    expect(LOG.error).toHaveBeenCalledWith('string error');
    expect(LOG.error).toHaveBeenCalledWith('custom stack');
  });
});
