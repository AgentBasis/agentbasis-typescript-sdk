import { describe, expect, it } from 'vitest';
import {
  ENV_VARS,
  getAgentBasisEnvVars,
  getEnvVar,
  getEnvVarBool,
  getEnvVarNumber,
  getRequiredEnvVar,
  isDebugMode,
} from '../../src/utils/env';

describe('env utilities', () => {
  it('reads environment variable values', () => {
    process.env.TEST_ENV_KEY = 'value-123';
    expect(getEnvVar('TEST_ENV_KEY')).toBe('value-123');
  });

  it('throws for missing required env var', () => {
    expect(() => getRequiredEnvVar('MISSING_REQUIRED_KEY')).toThrow(
      'Required environment variable MISSING_REQUIRED_KEY is not set'
    );
  });

  it('parses booleans with defaults', () => {
    expect(getEnvVarBool('MISSING_BOOL', true)).toBe(true);
    process.env.TEST_BOOL_TRUE = 'true';
    process.env.TEST_BOOL_ONE = '1';
    process.env.TEST_BOOL_FALSE = 'false';
    expect(getEnvVarBool('TEST_BOOL_TRUE')).toBe(true);
    expect(getEnvVarBool('TEST_BOOL_ONE')).toBe(true);
    expect(getEnvVarBool('TEST_BOOL_FALSE')).toBe(false);
  });

  it('parses numbers with defaults', () => {
    expect(getEnvVarNumber('MISSING_NUMBER', 42)).toBe(42);
    process.env.TEST_NUMBER = '7';
    process.env.TEST_BAD_NUMBER = 'not-a-number';
    expect(getEnvVarNumber('TEST_NUMBER', 0)).toBe(7);
    expect(getEnvVarNumber('TEST_BAD_NUMBER', 99)).toBe(99);
  });

  it('exposes combined AgentBasis env vars', () => {
    process.env[ENV_VARS.API_KEY] = 'env-api-key';
    process.env[ENV_VARS.AGENT_ID] = 'env-agent-id';
    process.env[ENV_VARS.DEBUG] = 'true';
    process.env[ENV_VARS.INCLUDE_CONTENT] = '1';

    expect(getAgentBasisEnvVars()).toEqual({
      apiKey: 'env-api-key',
      agentId: 'env-agent-id',
      debug: true,
      includeContent: true,
    });
    expect(isDebugMode()).toBe(true);
  });
});
