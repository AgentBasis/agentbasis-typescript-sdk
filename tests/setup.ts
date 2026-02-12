/**
 * Vitest global test setup
 */

import { beforeEach } from 'vitest';
import { setRuntimeDebugMode } from '../src/utils/logger';

// Reset environment variables before each test
beforeEach(() => {
  // Clear AgentBasis env vars
  delete process.env.AGENTBASIS_API_KEY;
  delete process.env.AGENTBASIS_AGENT_ID;
  delete process.env.AGENTBASIS_DEBUG;
  delete process.env.AGENTBASIS_INCLUDE_CONTENT;
  setRuntimeDebugMode(undefined);
});

// Global test utilities
export const mockApiKey = 'test-api-key-12345';
export const mockAgentId = 'test-agent-id-67890';

export function setupTestEnv(): void {
  process.env.AGENTBASIS_API_KEY = mockApiKey;
  process.env.AGENTBASIS_AGENT_ID = mockAgentId;
}

export function clearTestEnv(): void {
  delete process.env.AGENTBASIS_API_KEY;
  delete process.env.AGENTBASIS_AGENT_ID;
}
