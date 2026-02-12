/**
 * Internal logging utilities
 */

import { isDebugMode } from './env';

const PREFIX = '[AgentBasis]';
let runtimeDebugMode: boolean | undefined;

/**
 * Set runtime debug mode from SDK config.
 */
export function setRuntimeDebugMode(value: boolean | undefined): void {
  runtimeDebugMode = value;
}

/**
 * Log a debug message (only in debug mode)
 */
export function debug(message: string, ...args: unknown[]): void {
  const debugEnabled = runtimeDebugMode ?? isDebugMode();
  if (debugEnabled) {
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
