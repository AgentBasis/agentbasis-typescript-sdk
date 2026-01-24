/**
 * Configuration management for AgentBasis SDK
 */

import type { AgentBasisConfig, InitConfig } from '../types';
import { getAgentBasisEnvVars, ENV_VARS } from '../utils/env';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  includeContent: false,
  includeBinaryContent: false,
  batchSize: 100,
  flushIntervalMs: 5000,
  maxRetries: 3,
  debug: false,
} as const;

/**
 * Load configuration from environment variables and merge with provided config
 */
export function loadConfig(initConfig?: InitConfig): AgentBasisConfig {
  const envVars = getAgentBasisEnvVars();

  // Merge: defaults < env vars < explicit config
  const apiKey = initConfig?.apiKey ?? envVars.apiKey;
  const agentId = initConfig?.agentId ?? envVars.agentId;

  if (!apiKey) {
    throw new Error(
      `AgentBasis API key is required. Set ${ENV_VARS.API_KEY} env var or pass apiKey in config.`
    );
  }

  if (!agentId) {
    throw new Error(
      `AgentBasis Agent ID is required. Set ${ENV_VARS.AGENT_ID} env var or pass agentId in config.`
    );
  }

  const config: AgentBasisConfig = {
    apiKey,
    agentId,
    includeContent: initConfig?.includeContent ?? envVars.includeContent ?? DEFAULT_CONFIG.includeContent,
    includeBinaryContent: initConfig?.includeBinaryContent ?? DEFAULT_CONFIG.includeBinaryContent,
    batchSize: initConfig?.batchSize ?? DEFAULT_CONFIG.batchSize,
    flushIntervalMs: initConfig?.flushIntervalMs ?? DEFAULT_CONFIG.flushIntervalMs,
    maxRetries: initConfig?.maxRetries ?? DEFAULT_CONFIG.maxRetries,
    debug: initConfig?.debug ?? envVars.debug ?? DEFAULT_CONFIG.debug,
  };

  validateConfig(config);

  return config;
}

/**
 * Validate configuration values
 */
export function validateConfig(config: AgentBasisConfig): void {
  if (typeof config.apiKey !== 'string' || config.apiKey.length === 0) {
    throw new Error('Invalid API key: must be a non-empty string');
  }

  if (typeof config.agentId !== 'string' || config.agentId.length === 0) {
    throw new Error('Invalid Agent ID: must be a non-empty string');
  }

  if (config.batchSize < 1) {
    throw new Error('batchSize must be at least 1');
  }

  if (config.flushIntervalMs < 100) {
    throw new Error('flushIntervalMs must be at least 100ms');
  }

  if (config.maxRetries < 0) {
    throw new Error('maxRetries must be 0 or greater');
  }
}
