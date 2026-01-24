/**
 * AgentBasis TypeScript SDK
 *
 * Observability and monitoring for AI agents. Main entry point for the SDK.
 *
 * @example
 * ```typescript
 * import { AgentBasis } from 'agentbasis';
 *
 * // Initialize the SDK (reads from env vars)
 * AgentBasis.init();
 *
 * // Or with explicit config
 * AgentBasis.init({
 *   apiKey: 'your-api-key',
 *   agentId: 'your-agent-id',
 * });
 * ```
 */

// Core exports
export { AgentBasis } from './core/client';
export { init, flush, shutdown } from './core/client';
export { withContext, trace } from './core/context';

// Type exports
export type {
  AgentBasisConfig,
  TraceContext,
  TelemetryEvent,
  LLMCallEvent,
  SpanEvent,
} from './types';
