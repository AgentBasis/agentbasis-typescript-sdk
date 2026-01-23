/**
 * Google Generative AI (Gemini) instrumentation for AgentBasis
 *
 * @example
 * ```typescript
 * import { instrument } from 'agentbasis/llms/google-genai';
 *
 * // Call once at app startup
 * instrument();
 *
 * // Then use Google GenAI as normal - all calls are tracked
 * import { GoogleGenerativeAI } from '@google/generative-ai';
 * const genai = new GoogleGenerativeAI(apiKey);
 * ```
 */

/**
 * Instrument the Google Generative AI SDK to automatically track all LLM calls
 */
export function instrument(): void {
  // TODO: Implement Google GenAI instrumentation
  throw new Error('Not implemented');
}

/**
 * Remove instrumentation from the Google GenAI SDK
 */
export function uninstrument(): void {
  // TODO: Implement uninstrumentation
  throw new Error('Not implemented');
}
