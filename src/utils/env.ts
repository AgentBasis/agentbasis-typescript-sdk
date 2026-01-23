/**
 * Environment variable utilities
 */

/**
 * Get an environment variable value
 */
export function getEnvVar(name: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[name];
  }
  return undefined;
}

/**
 * Get a required environment variable, throw if not set
 */
export function getRequiredEnvVar(name: string): string {
  const value = getEnvVar(name);
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

/**
 * Check if running in debug mode
 */
export function isDebugMode(): boolean {
  const debug = getEnvVar('AGENTBASIS_DEBUG');
  return debug === 'true' || debug === '1';
}
