/**
 * Structured logger for server-side code.
 *
 * Use this instead of console.log in API routes and server utilities.
 * Each log line is a JSON object with { level, msg, ts, ...meta }.
 *
 * Adoption: replace console.log/error/warn calls opportunistically when
 * touching a file — do not mass-migrate all 188 call sites at once.
 */

const isDev = process.env.NODE_ENV !== 'production';

function log(level: 'info' | 'warn' | 'error', msg: string, meta?: object) {
  const entry = JSON.stringify({ level, msg, ts: Date.now(), ...meta });
  if (level === 'error') {
    console.error(entry);
  } else if (level === 'warn') {
    console.warn(entry);
  } else {
    console.log(entry);
  }
}

export const logger = {
  info: (msg: string, meta?: object) => log('info', msg, meta),
  warn: (msg: string, meta?: object) => log('warn', msg, meta),
  error: (msg: string, meta?: object) => log('error', msg, meta),
};
