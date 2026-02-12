/**
 * OpenAI instrumentation for AgentBasis
 *
 * Automatically tracks all OpenAI API calls.
 *
 * @example
 * ```typescript
 * import { AgentBasis } from 'agentbasis';
 * import { instrument } from 'agentbasis/llms/openai';
 *
 * // Initialize AgentBasis first
 * AgentBasis.init();
 *
 * // Then instrument OpenAI
 * instrument();
 *
 * // Use OpenAI as normal - all calls are tracked
 * import OpenAI from 'openai';
 * const openai = new OpenAI();
 * const response = await openai.chat.completions.create({...});
 * ```
 */

import { AgentBasis } from '../../core/client';
import type { Transport } from '../../core/transport';
import type { Span } from '@opentelemetry/api';
import { debug, warn } from '../../utils/logger';

/** Track if OpenAI has been instrumented */
let isInstrumented = false;

/** Store original methods for uninstrumentation */
const originalMethods: Map<string, unknown> = new Map();

/**
 * Instrument the OpenAI SDK to automatically track all LLM calls
 */
export function instrument(): void {
  if (isInstrumented) {
    warn('OpenAI is already instrumented');
    return;
  }

  if (!AgentBasis.isInitialized()) {
    throw new Error('AgentBasis must be initialized before instrumenting OpenAI. Call AgentBasis.init() first.');
  }

  try {
    // Dynamic import to avoid requiring OpenAI if not used
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const OpenAI = require('openai').default || require('openai');

    patchChatCompletions(OpenAI);
    patchCompletions(OpenAI);
    patchEmbeddings(OpenAI);

    isInstrumented = true;
    debug('OpenAI instrumentation enabled');
  } catch (err) {
    throw new Error(
      'Failed to instrument OpenAI. Make sure the "openai" package is installed.'
    );
  }
}

/**
 * Remove instrumentation from the OpenAI SDK
 */
export function uninstrument(): void {
  if (!isInstrumented) {
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const OpenAI = require('openai').default || require('openai');

    // Restore original methods
    for (const [key, method] of originalMethods.entries()) {
      const [className, methodName] = key.split('.');
      if (className === 'ChatCompletions' && OpenAI.prototype.chat?.completions) {
        // @ts-expect-error - Dynamic property access
        OpenAI.prototype.chat.completions[methodName] = method;
      }
    }

    originalMethods.clear();
    isInstrumented = false;
    debug('OpenAI instrumentation disabled');
  } catch {
    // Ignore errors during uninstrumentation
  }
}

/**
 * Patch chat.completions.create
 */
function patchChatCompletions(OpenAI: unknown): void {
  // @ts-expect-error - Accessing OpenAI internals
  const ChatCompletions = OpenAI.Chat?.Completions || OpenAI.prototype?.chat?.completions?.constructor;

  if (!ChatCompletions?.prototype?.create) {
    debug('ChatCompletions.create not found, skipping patch');
    return;
  }

  const originalCreate = ChatCompletions.prototype.create;
  originalMethods.set('ChatCompletions.create', originalCreate);

  ChatCompletions.prototype.create = async function patchedCreate(
    this: unknown,
    params: {
      model: string;
      messages: Array<{ role: string; content: string }>;
      stream?: boolean;
      [key: string]: unknown;
    },
    options?: unknown
  ): Promise<unknown> {
    const client = AgentBasis.getInstance();
    const transport = client.getTransport();

    const model = params.model || 'unknown';
    const isStreaming = params.stream === true;
    const span = transport.startLLMSpan(
      `openai.chat.completions.create`,
      'openai',
      model
    );

    try {
      // Call original method
      const result = await originalCreate.call(this, params, options);

      if (isStreaming) {
        // For streaming, wrap the async iterator
        return wrapStreamingResponse(result, span, transport, params);
      }

      // Non-streaming response
      const usage = result.usage;

      transport.endLLMSpan(span, {
        inputTokens: usage?.prompt_tokens,
        outputTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens,
        prompt: params.messages,
        response: result,
        streamed: false,
      });

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      transport.endLLMSpan(span, {
        error,
        prompt: params.messages,
        streamed: isStreaming,
      });
      throw err;
    }
  };
}

/**
 * Wrap streaming response to track completion
 */
async function* wrapStreamingResponse(
  stream: AsyncIterable<unknown>,
  span: Span,
  transport: Transport,
  params: { messages: Array<{ role: string; content: string }> }
): AsyncGenerator<unknown, void, undefined> {
  let totalContent = '';
  let finishReason: string | null = null;
  let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;

  try {
    for await (const chunk of stream) {
      // @ts-expect-error - Accessing OpenAI chunk structure
      const delta = chunk.choices?.[0]?.delta;
      // @ts-expect-error - Accessing OpenAI chunk structure
      const chunkFinishReason = chunk.choices?.[0]?.finish_reason;
      // @ts-expect-error - Accessing OpenAI chunk structure
      const chunkUsage = chunk.usage;

      if (delta?.content) {
        totalContent += delta.content;
      }

      if (chunkFinishReason) {
        finishReason = chunkFinishReason;
      }

      if (chunkUsage) {
        usage = chunkUsage;
      }

      yield chunk;
    }

    // Stream completed successfully
    transport.endLLMSpan(span, {
      inputTokens: usage?.prompt_tokens,
      outputTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
      prompt: params.messages,
      response: { content: totalContent, finish_reason: finishReason },
      streamed: true,
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    transport.endLLMSpan(span, {
      error,
      prompt: params.messages,
      streamed: true,
    });
    throw err;
  }
}

/**
 * Patch completions.create (legacy API)
 */
function patchCompletions(OpenAI: unknown): void {
  // @ts-expect-error - Accessing OpenAI internals
  const Completions = OpenAI.Completions || OpenAI.prototype?.completions?.constructor;

  if (!Completions?.prototype?.create) {
    debug('Completions.create not found, skipping patch');
    return;
  }

  const originalCreate = Completions.prototype.create;
  originalMethods.set('Completions.create', originalCreate);

  Completions.prototype.create = async function patchedCreate(
    this: unknown,
    params: {
      model: string;
      prompt: string | string[];
      [key: string]: unknown;
    },
    options?: unknown
  ): Promise<unknown> {
    const client = AgentBasis.getInstance();
    const transport = client.getTransport();

    const model = params.model || 'unknown';
    const span = transport.startLLMSpan(
      `openai.completions.create`,
      'openai',
      model
    );

    try {
      const result = await originalCreate.call(this, params, options);
      const usage = result.usage;

      transport.endLLMSpan(span, {
        inputTokens: usage?.prompt_tokens,
        outputTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens,
        prompt: params.prompt,
        response: result,
        streamed: false,
      });

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      transport.endLLMSpan(span, {
        error,
        prompt: params.prompt,
        streamed: false,
      });
      throw err;
    }
  };
}

/**
 * Patch embeddings.create
 */
function patchEmbeddings(OpenAI: unknown): void {
  // @ts-expect-error - Accessing OpenAI internals
  const Embeddings = OpenAI.Embeddings || OpenAI.prototype?.embeddings?.constructor;

  if (!Embeddings?.prototype?.create) {
    debug('Embeddings.create not found, skipping patch');
    return;
  }

  const originalCreate = Embeddings.prototype.create;
  originalMethods.set('Embeddings.create', originalCreate);

  Embeddings.prototype.create = async function patchedCreate(
    this: unknown,
    params: {
      model: string;
      input: string | string[];
      [key: string]: unknown;
    },
    options?: unknown
  ): Promise<unknown> {
    const client = AgentBasis.getInstance();
    const transport = client.getTransport();

    const model = params.model || 'unknown';
    const span = transport.startLLMSpan(
      `openai.embeddings.create`,
      'openai',
      model
    );

    try {
      const result = await originalCreate.call(this, params, options);
      const usage = result.usage;

      transport.endLLMSpan(span, {
        inputTokens: usage?.prompt_tokens,
        outputTokens: usage?.total_tokens,
        totalTokens: usage?.total_tokens,
        prompt: params.input,
        response: { embedding_count: Array.isArray(result.data) ? result.data.length : 1 },
        streamed: false,
      });

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      transport.endLLMSpan(span, {
        error,
        prompt: params.input,
        streamed: false,
      });
      throw err;
    }
  };
}

/**
 * Check if OpenAI is instrumented
 */
export function isOpenAIInstrumented(): boolean {
  return isInstrumented;
}
