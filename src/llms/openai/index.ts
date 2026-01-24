/**
 * OpenAI instrumentation for AgentBasis
 *
 * @example
 * ```typescript
 * import { instrument } from 'agentbasis/llms/openai';
 *
 * // Call once at app startup
 * instrument();
 *
 * // Then use OpenAI as normal - all calls are tracked
 * import OpenAI from 'openai';
 * const openai = new OpenAI();
 * ```
 */

/**
 * Instrument the OpenAI SDK to automatically track all LLM calls
 */
export function instrument(): void {
  // TODO: Implement OpenAI instrumentation
  throw new Error('Not implemented');
}

/**
 * Remove instrumentation from the OpenAI SDK
 */
export function uninstrument(): void {
  // TODO: Implement uninstrumentation
  throw new Error('Not implemented');
}
