/**
 * Vercel AI SDK integration for AgentBasis
 *
 * Provides wrappers for tracking Vercel AI SDK operations.
 *
 * @example
 * ```typescript
 * import { AgentBasis } from 'agentbasis';
 * import { wrapLanguageModel, trackAICall } from 'agentbasis/frameworks/vercel-ai';
 * import { openai } from '@ai-sdk/openai';
 * import { generateText, streamText } from 'ai';
 *
 * AgentBasis.init();
 *
 * // Option 1: Wrap the language model
 * const trackedModel = wrapLanguageModel(openai('gpt-4'));
 * const result = await generateText({
 *   model: trackedModel,
 *   prompt: 'Hello!',
 * });
 *
 * // Option 2: Use trackAICall wrapper
 * const result = await trackAICall('chat', async () => {
 *   return generateText({
 *     model: openai('gpt-4'),
 *     prompt: 'Hello!',
 *   });
 * });
 * ```
 */

import { AgentBasis } from '../../core/client';
import { warn } from '../../utils/logger';
import { SpanStatusCode } from '@opentelemetry/api';

/**
 * Vercel AI SDK LanguageModel interface (simplified)
 */
interface LanguageModel {
  modelId: string;
  provider: string;
  doGenerate?: (...args: unknown[]) => Promise<unknown>;
  doStream?: (...args: unknown[]) => Promise<unknown>;
  [key: string]: unknown;
}

/**
 * Vercel AI SDK result types
 */
interface GenerateTextResult {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
  [key: string]: unknown;
}

interface StreamTextResult {
  textStream: AsyncIterable<string>;
  usage?: Promise<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }>;
  [key: string]: unknown;
}

/**
 * Token usage interface
 */
interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Result with usage
 */
interface ResultWithUsage {
  usage?: TokenUsage;
  text?: string;
  [key: string]: unknown;
}

/**
 * Promise with usage
 */
interface PromiseWithUsage<T> extends Promise<T> {
  usage?: Promise<TokenUsage>;
}

/**
 * Stream result with usage
 */
interface StreamResultWithUsage {
  textStream: AsyncIterable<string>;
  usage?: Promise<TokenUsage>;
  [key: string]: unknown;
}

/**
 * Type guard for usage
 */
function hasUsage(obj: unknown): obj is { usage: TokenUsage } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'usage' in obj &&
    typeof (obj as { usage: unknown }).usage === 'object'
  );
}

/**
 * Type guard for stream usage
 */
function hasStreamUsage(obj: unknown): obj is { usage: Promise<TokenUsage> } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'usage' in obj &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (obj as any).usage?.then === 'function'
  );
}

/**
 * Wrap a Vercel AI SDK language model with AgentBasis tracing
 *
 * @param model - The language model to wrap
 * @returns Wrapped model with tracing
 *
 * @example
 * ```typescript
 * import { openai } from '@ai-sdk/openai';
 * import { wrapLanguageModel } from 'agentbasis/frameworks/vercel-ai';
 *
 * const trackedModel = wrapLanguageModel(openai('gpt-4'));
 * ```
 */
export function wrapLanguageModel<T extends LanguageModel>(model: T): T {
  if (!AgentBasis.isInitialized()) {
    warn('AgentBasis not initialized. Model will not be traced.');
    return model;
  }

  const wrappedModel = Object.create(model);
  const modelId = model.modelId || 'unknown';
  const provider = model.provider || 'vercel-ai';

  // Wrap doGenerate if it exists
  if (typeof model.doGenerate === 'function') {
    const originalDoGenerate = model.doGenerate.bind(model);

    wrappedModel.doGenerate = async function trackedDoGenerate(
      ...args: unknown[]
    ): Promise<unknown> {
      const transport = AgentBasis.getInstance().getTransport();

      const span = transport.startLLMSpan(
        `vercel-ai.generate`,
        provider,
        modelId
      );

      try {
        const result = await originalDoGenerate(...args);
        
        // Extract usage safely
        let usage: TokenUsage | undefined;
        if (hasUsage(result)) {
          usage = result.usage;
        }

        transport.endLLMSpan(span, {
          inputTokens: usage?.promptTokens,
          outputTokens: usage?.completionTokens,
          totalTokens: usage?.totalTokens,
          response: result,
          streamed: false,
        });

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        transport.endLLMSpan(span, {
          error,
          streamed: false,
        });
        throw err;
      }
    };
  }

  // Wrap doStream if it exists
  if (typeof model.doStream === 'function') {
    const originalDoStream = model.doStream.bind(model);

    wrappedModel.doStream = async function trackedDoStream(
      ...args: unknown[]
    ): Promise<unknown> {
      const transport = AgentBasis.getInstance().getTransport();

      const span = transport.startLLMSpan(
        `vercel-ai.stream`,
        provider,
        modelId
      );

      try {
        const result = await originalDoStream(...args);

        // Check for usage promise safely
        if (hasStreamUsage(result)) {
          result.usage.then((usage: TokenUsage) => {
            transport.endLLMSpan(span, {
              inputTokens: usage?.promptTokens,
              outputTokens: usage?.completionTokens,
              totalTokens: usage?.totalTokens,
              streamed: true,
            });
          }).catch((err: Error) => {
            transport.endLLMSpan(span, {
              error: err,
              streamed: true,
            });
          });
        } else {
          // End span immediately if no usage promise
          transport.endLLMSpan(span, {
            streamed: true,
          });
        }

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        transport.endLLMSpan(span, {
          error,
          streamed: true,
        });
        throw err;
      }
    };
  }

  return wrappedModel as T;
}

/**
 * Track an AI SDK call with a custom wrapper
 *
 * Use this when you want explicit control over what gets tracked.
 *
 * @param name - Name for the span
 * @param fn - Async function that makes the AI call
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * const result = await trackAICall('summarize', async () => {
 *   return generateText({
 *     model: openai('gpt-4'),
 *     prompt: 'Summarize this...',
 *   });
 * });
 * ```
 */
export async function trackAICall<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!AgentBasis.isInitialized()) {
    return fn();
  }

  const transport = AgentBasis.getInstance().getTransport();

  const span = transport.startSpan(`vercel-ai.${name}`);

  try {
    const result = await fn();

    // Safely check for usage and text
    if (typeof result === 'object' && result !== null) {
      if (hasUsage(result)) {
        const usage = result.usage;
        span.setAttribute('ai.input_tokens', usage.promptTokens || 0);
        span.setAttribute('ai.output_tokens', usage.completionTokens || 0);
        span.setAttribute('ai.total_tokens', usage.totalTokens || 0);
      }
      
      const config = AgentBasis.getConfig();
      if (config?.includeContent && 'text' in result && typeof (result as { text: unknown }).text === 'string') {
        span.setAttribute('ai.response_text', (result as { text: string }).text);
      }
    }

    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
    return result;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    span.recordException(error);
    span.end();
    throw err;
  }
}

/**
 * Track a streaming AI call
 *
 * Wraps the stream to track when it completes.
 *
 * @param name - Name for the span
 * @param streamResult - The stream result from streamText/streamObject
 * @returns The same stream result with tracking
 *
 * @example
 * ```typescript
 * const result = await streamText({
 *   model: openai('gpt-4'),
 *   prompt: 'Hello!',
 * });
 *
 * const trackedResult = trackStreamingCall('chat', result);
 * for await (const chunk of trackedResult.textStream) {
 *   console.log(chunk);
 * }
 * ```
 */
export function trackStreamingCall<T extends Partial<StreamResultWithUsage>>(
  name: string,
  streamResult: T
): T {
  if (!AgentBasis.isInitialized()) {
    return streamResult;
  }

  const transport = AgentBasis.getInstance().getTransport();
  const span = transport.startSpan(`vercel-ai.stream.${name}`);
  let ended = false;
  const endStreamSpan = (options?: { error?: Error }): void => {
    if (ended) return;
    ended = true;
    if (options?.error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: options.error.message,
      });
      span.recordException(options.error);
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }
    span.end();
  };

  // Track via usage promise if available
  if (hasStreamUsage(streamResult)) {
    streamResult.usage
      .then((usage) => {
        if (usage?.promptTokens !== undefined) {
          span.setAttribute('ai.input_tokens', usage.promptTokens);
        }
        if (usage?.completionTokens !== undefined) {
          span.setAttribute('ai.output_tokens', usage.completionTokens);
        }
        endStreamSpan();
      })
      .catch((err: Error) => {
        endStreamSpan({ error: err });
      });
  }

  // If no usage promise, wrap the text stream
  if (streamResult.textStream && !hasStreamUsage(streamResult)) {
    const originalStream = streamResult.textStream;

    const wrappedStream = (async function* (): AsyncGenerator<string, void, undefined> {
      try {
        for await (const chunk of originalStream) {
          yield chunk;
        }
        endStreamSpan();
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        endStreamSpan({ error });
        throw err;
      }
    })();

    streamResult.textStream = wrappedStream;
  }

  return streamResult;
}

/**
 * Create middleware for AI SDK (experimental)
 *
 * Note: This is a placeholder for future AI SDK middleware support.
 * The AI SDK may add official middleware/plugin support in the future.
 */
export function createMiddleware(): {
  wrapModel: typeof wrapLanguageModel;
  trackCall: typeof trackAICall;
  trackStream: typeof trackStreamingCall;
} {
  return {
    wrapModel: wrapLanguageModel,
    trackCall: trackAICall,
    trackStream: trackStreamingCall,
  };
}
