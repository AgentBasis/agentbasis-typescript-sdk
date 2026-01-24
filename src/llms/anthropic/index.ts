/**
 * Anthropic instrumentation for AgentBasis
 *
 * @example
 * ```typescript
 * import { instrument } from 'agentbasis/llms/anthropic';
 *
 * // Call once at app startup
 * instrument();
 *
 * // Then use Anthropic as normal - all calls are tracked
 * import Anthropic from '@anthropic-ai/sdk';
 * const anthropic = new Anthropic();
 * ```
 */

/**
 * Instrument the Anthropic SDK to automatically track all LLM calls
 */
export function instrument(): void {
    // TODO: Implement Anthropic instrumentation
    throw new Error('Not implemented');
  }
  
  /**
   * Remove instrumentation from the Anthropic SDK
   */
  export function uninstrument(): void {
    // TODO: Implement uninstrumentation
    throw new Error('Not implemented');
  }
  