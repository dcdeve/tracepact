export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = 'warn';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function withLogLevel<T>(level: LogLevel, fn: () => T): T {
  const previous = currentLevel;
  currentLevel = level;
  try {
    return fn();
  } finally {
    currentLevel = previous;
  }
}

export function initLogLevelFromEnv(): void {
  const env = process.env.TRACEPACT_LOG;
  if (env && env in LEVEL_ORDER) {
    currentLevel = env as LogLevel;
  }
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel];
}

export const log = {
  debug(msg: string, ...args: unknown[]): void {
    if (shouldLog('debug')) console.error(`[tracepact:debug] ${msg}`, ...args);
  },
  info(msg: string, ...args: unknown[]): void {
    if (shouldLog('info')) console.error(`[tracepact:info] ${msg}`, ...args);
  },
  warn(msg: string, ...args: unknown[]): void {
    if (shouldLog('warn')) console.error(`[tracepact:warn] ${msg}`, ...args);
  },
  error(msg: string, ...args: unknown[]): void {
    if (shouldLog('error')) console.error(`[tracepact:error] ${msg}`, ...args);
  },
};
