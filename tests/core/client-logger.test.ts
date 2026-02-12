import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentBasis } from '../../src/core/client';
import { debug, setRuntimeDebugMode } from '../../src/utils/logger';

describe('client lifecycle and logger behavior', () => {
  afterEach(async () => {
    await AgentBasis.shutdown();
    setRuntimeDebugMode(undefined);
  });

  it('initializes once and supports re-init after shutdown', async () => {
    const first = AgentBasis.init({
      apiKey: 'test-key',
      agentId: 'test-agent',
      debug: false,
    });
    const second = AgentBasis.init({
      apiKey: 'ignored-key',
      agentId: 'ignored-agent',
      debug: true,
    });

    expect(first).toBe(second);
    expect(AgentBasis.isInitialized()).toBe(true);
    expect(AgentBasis.getConfig()?.agentId).toBe('test-agent');

    await AgentBasis.shutdown();
    expect(AgentBasis.isInitialized()).toBe(false);

    const third = AgentBasis.init({
      apiKey: 'test-key-2',
      agentId: 'test-agent-2',
      debug: true,
    });
    expect(third).toBeDefined();
    expect(AgentBasis.getConfig()?.agentId).toBe('test-agent-2');
  });

  it('handles concurrent shutdown calls safely', async () => {
    AgentBasis.init({
      apiKey: 'test-key',
      agentId: 'test-agent',
      debug: false,
    });

    await Promise.all([AgentBasis.shutdown(), AgentBasis.shutdown(), AgentBasis.shutdown()]);
    expect(AgentBasis.isInitialized()).toBe(false);
  });

  it('uses runtime debug mode before env debug mode', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    process.env.AGENTBASIS_DEBUG = 'false';
    setRuntimeDebugMode(true);
    debug('runtime-enabled');
    expect(logSpy).toHaveBeenCalledTimes(1);

    setRuntimeDebugMode(false);
    debug('runtime-disabled');
    expect(logSpy).toHaveBeenCalledTimes(1);

    setRuntimeDebugMode(undefined);
    process.env.AGENTBASIS_DEBUG = 'true';
    debug('env-enabled');
    expect(logSpy).toHaveBeenCalledTimes(2);
  });
});
