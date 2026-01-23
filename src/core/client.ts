/**
 * AgentBasis SDK Client
 *
 * Main client class for initializing and managing the SDK.
 */

import type { AgentBasisConfig } from '../types';

/**
 * AgentBasis SDK singleton client
 */
export class AgentBasis {
  private static instance: AgentBasis | null = null;
  private config: AgentBasisConfig | null = null;
  private initialized = false;

  private constructor() {}

  /**
   * Initialize the AgentBasis SDK
   */
  static init(config?: Partial<AgentBasisConfig>): AgentBasis {
    // TODO: Implement initialization logic
    throw new Error('Not implemented');
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): AgentBasis {
    if (!AgentBasis.instance) {
      throw new Error('AgentBasis not initialized. Call AgentBasis.init() first.');
    }
    return AgentBasis.instance;
  }

  /**
   * Flush all pending telemetry data
   */
  static async flush(timeoutMillis = 30000): Promise<boolean> {
    // TODO: Implement flush logic
    throw new Error('Not implemented');
  }

  /**
   * Shutdown the SDK gracefully
   */
  static async shutdown(): Promise<void> {
    // TODO: Implement shutdown logic
    throw new Error('Not implemented');
  }
}

// Convenience function exports
export const init = AgentBasis.init.bind(AgentBasis);
export const flush = AgentBasis.flush.bind(AgentBasis);
export const shutdown = AgentBasis.shutdown.bind(AgentBasis);
