import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, loadConfig, validateConfig } from '../../src/core/config';
import { ENV_VARS } from '../../src/utils/env';
import type { AgentBasisConfig } from '../../src/types';

describe('config loading and validation', () => {
  it('loads from explicit init config', () => {
    const config = loadConfig({
      apiKey: 'explicit-key',
      agentId: 'explicit-agent',
      includeContent: true,
      includeBinaryContent: true,
      batchSize: 25,
      flushIntervalMs: 1500,
      maxRetries: 5,
      debug: true,
    });

    expect(config).toEqual({
      apiKey: 'explicit-key',
      agentId: 'explicit-agent',
      includeContent: true,
      includeBinaryContent: true,
      batchSize: 25,
      flushIntervalMs: 1500,
      maxRetries: 5,
      debug: true,
    });
  });

  it('falls back to environment variables', () => {
    process.env[ENV_VARS.API_KEY] = 'env-key';
    process.env[ENV_VARS.AGENT_ID] = 'env-agent';
    process.env[ENV_VARS.DEBUG] = 'true';
    process.env[ENV_VARS.INCLUDE_CONTENT] = '1';

    const config = loadConfig();
    expect(config.apiKey).toBe('env-key');
    expect(config.agentId).toBe('env-agent');
    expect(config.debug).toBe(true);
    expect(config.includeContent).toBe(true);
    expect(config.batchSize).toBe(DEFAULT_CONFIG.batchSize);
  });

  it('throws when required keys are missing', () => {
    expect(() => loadConfig()).toThrow(ENV_VARS.API_KEY);
    process.env[ENV_VARS.API_KEY] = 'only-key';
    expect(() => loadConfig()).toThrow(ENV_VARS.AGENT_ID);
  });

  it('validates runtime bounds', () => {
    const base: AgentBasisConfig = {
      apiKey: 'k',
      agentId: 'a',
      includeContent: false,
      includeBinaryContent: false,
      batchSize: 100,
      flushIntervalMs: 5000,
      maxRetries: 3,
      debug: false,
    };

    expect(() => validateConfig({ ...base, batchSize: 0 })).toThrow('batchSize');
    expect(() => validateConfig({ ...base, flushIntervalMs: 10 })).toThrow('flushIntervalMs');
    expect(() => validateConfig({ ...base, maxRetries: -1 })).toThrow('maxRetries');
  });
});
