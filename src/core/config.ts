/**
 * Configuration management for AgentBasis SDK
 */

import type { AgentBasisConfig } from '../types';
import { getEnvVar } from '../utils/env';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Partial<AgentBasisConfig> = {
  baseUrl: 'https://api.agentbasis.co',
  includeContent: false,
  includeBinaryContent: false,
  batchSize: 100,
  flushIntervalMs: 5000,
  maxRetries: 3,
  debug: false,
};

/**
 * Load configuration from environment variables and merge with provided config
 */
export function loadConfig(config?: Partial<AgentBasisConfig>): AgentBasisConfig {
  const apiKey = config?.apiKey ?? getEnvVar('AGENTBASIS_API_KEY');
  const agentId = config?.agentId ?? getEnvVar('AGENTBASIS_AGENT_ID');

  if (!apiKey) {
    throw new Error(
      'AgentBasis API key is required. Set AGENTBASIS_API_KEY env var or pass apiKey in config.'
    );
  }

  if (!agentId) {
    throw new Error(
      'AgentBasis Agent ID is required. Set AGENTBASIS_AGENT_ID env var or pass agentId in config.'
    );
  }

  return {
    ...DEFAULT_CONFIG,
    ...config,
    apiKey,
    agentId,
  } as AgentBasisConfig;
}

/**
 * Validate configuration
 */
export function validateConfig(config: AgentBasisConfig): void {
  if (typeof config.apiKey !== 'string' || config.apiKey.length === 0) {
    throw new Error('Invalid API key');
  }

  if (typeof config.agentId !== 'string' || config.agentId.length === 0) {
    throw new Error('Invalid Agent ID');
  }

  if (config.batchSize !== undefined && config.batchSize < 1) {
    throw new Error('batchSize must be at least 1');
  }

  if (config.flushIntervalMs !== undefined && config.flushIntervalMs < 100) {
    throw new Error('flushIntervalMs must be at least 100');
  }
}
