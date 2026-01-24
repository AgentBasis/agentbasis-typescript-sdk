/**
 * AgentBasis TypeScript SDK
 *
 * Observability and monitoring for AI agents. Main entry point for the SDK.
 *
 * @example
 * ```typescript
 * import { AgentBasis, withContext, trace } from 'agentbasis';
 *
 * // Initialize the SDK (reads from env vars)
 * AgentBasis.init();
 *
 * // Or with explicit config
 * AgentBasis.init({
 *   apiKey: 'your-api-key',
 *   agentId: 'your-agent-id',
 * });
 *
 * // Track context across LLM calls
 * await withContext({ userId: '123' }, async () => {
 *   await openai.chat.completions.create({...});
 * });
 *
 * // Trace custom functions
 * const myFunction = trace('myFunction', async (input) => {
 *   return result;
 * });
 *
 * // Flush before process exit
 * await AgentBasis.flush();
 *
 * // Shutdown gracefully
 * await AgentBasis.shutdown();
 * ```
 */

// Core exports
export { AgentBasis, init, flush, shutdown, isInitialized } from './core/client';
export {
  withContext,
  trace,
  getCurrentContext,
  getCurrentSpan,
  addSpanAttributes,
  recordError,
} from './core/context';

// Type exports
export type {
  // Config types
  AgentBasisConfig,
  InitConfig,
  // Context types
  TraceContext,
  // Event types
  EventType,
  LLMProvider,
  BaseTelemetryEvent,
  TelemetryEvent,
  LLMCallEvent,
  SpanEvent,
  LogEvent,
  ErrorEvent,
  // API types
  TelemetryBatch,
  APIResponse,
} from './types';
