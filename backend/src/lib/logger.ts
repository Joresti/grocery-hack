type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...data,
  };
  const output = JSON.stringify(entry);

  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  debug: (message: string, data?: Record<string, unknown>): void => log('debug', message, data),
  info: (message: string, data?: Record<string, unknown>): void => log('info', message, data),
  warn: (message: string, data?: Record<string, unknown>): void => log('warn', message, data),
  error: (message: string, data?: Record<string, unknown>): void => log('error', message, data),
};
