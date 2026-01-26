/**
 * AgentBasis SDK Client
 *
 * Main client class for initializing and managing the SDK.
 */

import type { AgentBasisConfig, InitConfig } from '../types';
import { loadConfig } from './config';
import { Transport } from './transport';
import { debug, warn } from '../utils/logger';

/**
 * AgentBasis SDK singleton client
 */
export class AgentBasis {
  private static instance: AgentBasis | null = null;

  private config: AgentBasisConfig;
  private transport: Transport;
  private initialized = false;

  private constructor(config: AgentBasisConfig) {
    this.config = config;
    this.transport = new Transport(config);
    this.initialized = true;

    // Start auto-flush
    this.transport.startAutoFlush();

    // Handle process exit
    this.setupShutdownHandlers();

    debug('AgentBasis SDK initialized', { agentId: config.agentId });
  }

  /**
   * Initialize the AgentBasis SDK
   *
   * @param config - Optional configuration (uses env vars for missing values)
   * @returns The AgentBasis instance
   *
   * @example
   * ```typescript
   * // Using environment variables
   * AgentBasis.init();
   *
   * // With explicit config
   * AgentBasis.init({
   *   apiKey: 'your-api-key',
   *   agentId: 'your-agent-id',
   * });
   * ```
   */
  static init(config?: InitConfig): AgentBasis {
    if (AgentBasis.instance) {
      warn('AgentBasis already initialized. Returning existing instance.');
      return AgentBasis.instance;
    }

    const resolvedConfig = loadConfig(config);
    AgentBasis.instance = new AgentBasis(resolvedConfig);

    return AgentBasis.instance;
  }

  /**
   * Get the singleton instance
   *
   * @throws Error if AgentBasis has not been initialized
   */
  static getInstance(): AgentBasis {
    if (!AgentBasis.instance) {
      throw new Error('AgentBasis not initialized. Call AgentBasis.init() first.');
    }
    return AgentBasis.instance;
  }

  /**
   * Check if the SDK has been initialized
   */
  static isInitialized(): boolean {
    return AgentBasis.instance !== null;
  }

  /**
   * Get the current configuration
   */
  static getConfig(): AgentBasisConfig | null {
    return AgentBasis.instance?.config ?? null;
  }

  /**
   * Get the transport instance (internal use)
   */
  getTransport(): Transport {
    return this.transport;
  }

  /**
   * Flush all pending telemetry data
   *
   * @param timeoutMillis - Maximum time to wait for flush (default: 30000ms)
   * @returns true if flush completed successfully
   */
  static async flush(timeoutMillis = 30000): Promise<boolean> {
    if (!AgentBasis.instance) {
      warn('AgentBasis not initialized. Nothing to flush.');
      return false;
    }

    debug('Flushing telemetry data...');
    return AgentBasis.instance.transport.flush(timeoutMillis);
  }

  /**
   * Shutdown the SDK gracefully
   *
   * Flushes all pending events and stops background tasks.
   */
  static async shutdown(): Promise<void> {
    if (!AgentBasis.instance) {
      return;
    }

    debug('Shutting down AgentBasis SDK...');

    await AgentBasis.instance.transport.shutdown();
    AgentBasis.instance = null;

    debug('AgentBasis SDK shutdown complete');
  }

  /**
   * Track a telemetry event (internal use)
   * @deprecated Use withContext() or trace() instead
   */
  static track(event: Record<string, unknown>): void {
    if (!AgentBasis.instance) {
      warn('AgentBasis not initialized. Event not tracked.');
      return;
    }

    // Note: Events are now tracked via OTEL spans
    // This method is kept for potential future use
    debug('track() called - consider using withContext() or trace() instead', event);
  }

  /**
   * Set up handlers for graceful shutdown on process exit
   */
  private setupShutdownHandlers(): void {
    if (typeof process === 'undefined') {
      return;
    }

    const handleShutdown = async (): Promise<void> => {
      await AgentBasis.shutdown();
    };

    // Handle various exit signals
    process.on('beforeExit', () => {
      void handleShutdown();
    });

    process.on('SIGINT', () => {
      void handleShutdown();
    });

    process.on('SIGTERM', () => {
      void handleShutdown();
    });
  }
}

// Convenience function exports
export const init = AgentBasis.init;
export const flush = AgentBasis.flush;
export const shutdown = AgentBasis.shutdown;
export const isInitialized = AgentBasis.isInitialized;
