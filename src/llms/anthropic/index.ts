/**
 * Anthropic instrumentation for AgentBasis
 *
 * Automatically tracks all Anthropic API calls.
 *
 * @example
 * ```typescript
 * import { AgentBasis } from 'agentbasis';
 * import { instrument } from 'agentbasis/llms/anthropic';
 *
 * // Initialize AgentBasis first
 * AgentBasis.init();
 *
 * // Then instrument Anthropic
 * instrument();
 *
 * // Use Anthropic as normal - all calls are tracked
 * import Anthropic from '@anthropic-ai/sdk';
 * const anthropic = new Anthropic();
 * const response = await anthropic.messages.create({...});
 * ```
 */

import { AgentBasis } from '../../core/client';
import type { Transport } from '../../core/transport';
import type { Span } from '@opentelemetry/api';
import { debug, warn } from '../../utils/logger';

/** Track if Anthropic has been instrumented */
let isInstrumented = false;

/** Store original methods for uninstrumentation */
const originalMethods: Map<string, unknown> = new Map();

/**
 * Instrument the Anthropic SDK to automatically track all LLM calls
 */
export function instrument(): void {
  if (isInstrumented) {
    warn('Anthropic is already instrumented');
    return;
  }

  if (!AgentBasis.isInitialized()) {
    throw new Error('AgentBasis must be initialized before instrumenting Anthropic. Call AgentBasis.init() first.');
  }

  try {
    // Dynamic import to avoid requiring Anthropic if not used
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');

    patchMessages(Anthropic);

    isInstrumented = true;
    debug('Anthropic instrumentation enabled');
  } catch (err) {
    throw new Error(
      'Failed to instrument Anthropic. Make sure the "@anthropic-ai/sdk" package is installed.'
    );
  }
}

/**
 * Remove instrumentation from the Anthropic SDK
 */
export function uninstrument(): void {
  if (!isInstrumented) {
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');
    const Messages = Anthropic.Messages || Anthropic.prototype?.messages?.constructor;

    // Restore original methods
    for (const [key, method] of originalMethods.entries()) {
      const [className, methodName] = key.split('.');
      if (className === 'Messages' && Messages?.prototype) {
        // @ts-expect-error - Dynamic property access
        Messages.prototype[methodName] = method;
      }
    }

    originalMethods.clear();
    isInstrumented = false;
    debug('Anthropic instrumentation disabled');
  } catch {
    // Ignore errors during uninstrumentation
  }
}

/**
 * Patch messages.create
 */
function patchMessages(Anthropic: unknown): void {
  // @ts-expect-error - Accessing Anthropic internals
  const Messages = Anthropic.Messages || Anthropic.prototype?.messages?.constructor;

  if (!Messages?.prototype?.create) {
    debug('Messages.create not found, skipping patch');
    return;
  }

  const originalCreate = Messages.prototype.create;
  originalMethods.set('Messages.create', originalCreate);

  Messages.prototype.create = async function patchedCreate(
    this: unknown,
    params: {
      model: string;
      messages: Array<{ role: string; content: string | Array<unknown> }>;
      max_tokens: number;
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
      `anthropic.messages.create`,
      'anthropic',
      model
    );

    try {
      // Call original method
      const result = await originalCreate.call(this, params, options);

      if (isStreaming) {
        // For streaming, wrap the stream
        return wrapStreamingResponse(result, span, transport, params);
      }

      // Non-streaming response
      const usage = result.usage;

      transport.endLLMSpan(span, {
        inputTokens: usage?.input_tokens,
        outputTokens: usage?.output_tokens,
        totalTokens: (usage?.input_tokens || 0) + (usage?.output_tokens || 0),
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

  // Also patch stream method if it exists
  if (Messages.prototype.stream) {
    const originalStream = Messages.prototype.stream;
    originalMethods.set('Messages.stream', originalStream);

    Messages.prototype.stream = function patchedStream(
      this: unknown,
      params: {
        model: string;
        messages: Array<{ role: string; content: string | Array<unknown> }>;
        max_tokens: number;
        [key: string]: unknown;
      },
      options?: unknown
    ): unknown {
      const client = AgentBasis.getInstance();
      const transport = client.getTransport();

      const model = params.model || 'unknown';

      const span = transport.startLLMSpan(
        `anthropic.messages.stream`,
        'anthropic',
        model
      );

      try {
        const stream = originalStream.call(this, params, options);

        // Wrap the stream to track completion
        return wrapAnthropicStream(stream, span, transport, params);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        transport.endLLMSpan(span, {
          error,
          prompt: params.messages,
          streamed: true,
        });
        throw err;
      }
    };
  }
}

/**
 * Wrap streaming response to track completion
 */
async function* wrapStreamingResponse(
  stream: AsyncIterable<unknown>,
  span: Span,
  transport: Transport,
  params: { messages: Array<{ role: string; content: string | Array<unknown> }> }
): AsyncGenerator<unknown, void, undefined> {
  let totalContent = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let stopReason: string | null = null;

  try {
    for await (const event of stream) {
      // @ts-expect-error - Accessing Anthropic event structure
      const eventType = event.type;

      if (eventType === 'content_block_delta') {
        // @ts-expect-error - Accessing Anthropic event structure
        const delta = event.delta;
        if (delta?.text) {
          totalContent += delta.text;
        }
      }

      if (eventType === 'message_delta') {
        // @ts-expect-error - Accessing Anthropic event structure
        stopReason = event.delta?.stop_reason || stopReason;
        // @ts-expect-error - Accessing Anthropic event structure
        outputTokens = event.usage?.output_tokens || outputTokens;
      }

      if (eventType === 'message_start') {
        // @ts-expect-error - Accessing Anthropic event structure
        inputTokens = event.message?.usage?.input_tokens || inputTokens;
      }

      yield event;
    }

    // Stream completed successfully
    transport.endLLMSpan(span, {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      prompt: params.messages,
      response: { content: totalContent, stop_reason: stopReason },
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
 * Wrap Anthropic MessageStream helper
 */
function wrapAnthropicStream(
  stream: unknown,
  span: Span,
  transport: Transport,
  params: { messages: Array<{ role: string; content: string | Array<unknown> }> }
): unknown {
  // The Anthropic SDK's stream() returns a MessageStream object
  // We need to intercept the finalMessage or on('end') event

  // @ts-expect-error - Accessing stream methods
  if (typeof stream.on === 'function') {
    let inputTokens = 0;
    let outputTokens = 0;
    let ended = false;
    const endStreamSpan = (opts: Parameters<Transport['endLLMSpan']>[1]): void => {
      if (ended) return;
      ended = true;
      transport.endLLMSpan(span, opts);
    };

    // @ts-expect-error - Accessing stream methods
    stream.on('message', (message: unknown) => {
      // @ts-expect-error - Accessing message structure
      const usage = message.usage;
      if (usage) {
        inputTokens = usage.input_tokens || inputTokens;
        outputTokens = usage.output_tokens || outputTokens;
      }

      endStreamSpan({
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        prompt: params.messages,
        response: message,
        streamed: true,
      });
    });

    // If stream ends without a message payload, still close span.
    // @ts-expect-error - Accessing stream methods
    stream.on('end', () => {
      endStreamSpan({
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        prompt: params.messages,
        streamed: true,
      });
    });

    // @ts-expect-error - Accessing stream methods
    stream.on('error', (err: Error) => {
      endStreamSpan({
        error: err,
        prompt: params.messages,
        streamed: true,
      });
    });
  }

  return stream;
}

/**
 * Check if Anthropic is instrumented
 */
export function isAnthropicInstrumented(): boolean {
  return isInstrumented;
}
