/**
 * Environment variable utilities for AgentBasis SDK
 */

/** Environment variable names used by the SDK */
export const ENV_VARS = {
  API_KEY: 'AGENTBASIS_API_KEY',
  AGENT_ID: 'AGENTBASIS_AGENT_ID',
  BASE_URL: 'AGENTBASIS_BASE_URL',
  DEBUG: 'AGENTBASIS_DEBUG',
  INCLUDE_CONTENT: 'AGENTBASIS_INCLUDE_CONTENT',
} as const;

/**
 * Get an environment variable value
 */
export function getEnvVar(name: string): string | undefined {
  // Node.js environment
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
 * Get an environment variable as a boolean
 */
export function getEnvVarBool(name: string, defaultValue = false): boolean {
  const value = getEnvVar(name);
  if (value === undefined) {
    return defaultValue;
  }
  return value === 'true' || value === '1';
}

/**
 * Get an environment variable as a number
 */
export function getEnvVarNumber(name: string, defaultValue: number): number {
  const value = getEnvVar(name);
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Check if running in debug mode
 */
export function isDebugMode(): boolean {
  return getEnvVarBool(ENV_VARS.DEBUG, false);
}

/**
 * Get all AgentBasis environment variables
 */
export function getAgentBasisEnvVars(): {
  apiKey?: string;
  agentId?: string;
  baseUrl?: string;
  debug: boolean;
  includeContent: boolean;
} {
  return {
    apiKey: getEnvVar(ENV_VARS.API_KEY),
    agentId: getEnvVar(ENV_VARS.AGENT_ID),
    baseUrl: getEnvVar(ENV_VARS.BASE_URL),
    debug: getEnvVarBool(ENV_VARS.DEBUG, false),
    includeContent: getEnvVarBool(ENV_VARS.INCLUDE_CONTENT, false),
  };
}
