/**
 * Internal logging utilities
 */

import { isDebugMode } from './env';

const PREFIX = '[AgentBasis]';

/**
 * Log a debug message (only in debug mode)
 */
export function debug(message: string, ...args: unknown[]): void {
  if (isDebugMode()) {
    console.log(`${PREFIX} DEBUG:`, message, ...args);
  }
}

/**
 * Log a warning message
 */
export function warn(message: string, ...args: unknown[]): void {
  console.warn(`${PREFIX} WARN:`, message, ...args);
}

/**
 * Log an error message
 */
export function error(message: string, ...args: unknown[]): void {
  console.error(`${PREFIX} ERROR:`, message, ...args);
}
