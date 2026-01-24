/**
 * Google Generative AI (Gemini) instrumentation for AgentBasis
 *
 * Automatically tracks all Gemini API calls.
 *
 * @example
 * ```typescript
 * import { AgentBasis } from 'agentbasis';
 * import { instrument } from 'agentbasis/llms/gemini';
 *
 * // Initialize AgentBasis first
 * AgentBasis.init();
 *
 * // Then instrument Gemini
 * instrument();
 *
 * // Use Gemini as normal - all calls are tracked
 * import { GoogleGenerativeAI } from '@google/generative-ai';
 * const genai = new GoogleGenerativeAI(apiKey);
 * const model = genai.getGenerativeModel({ model: 'gemini-pro' });
 * const response = await model.generateContent('Hello!');
 * ```
 */

import { AgentBasis } from '../../core/client';
import { debug, warn } from '../../utils/logger';

/** Track if Gemini has been instrumented */
let isInstrumented = false;

/** Store original methods for uninstrumentation */
const originalMethods: Map<string, unknown> = new Map();

/**
 * Instrument the Google Generative AI SDK to automatically track all LLM calls
 */
export function instrument(): void {
  if (isInstrumented) {
    warn('Gemini is already instrumented');
    return;
  }

  if (!AgentBasis.isInitialized()) {
    throw new Error('AgentBasis must be initialized before instrumenting Gemini. Call AgentBasis.init() first.');
  }

  try {
    // Dynamic import to avoid requiring Gemini if not used
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const genaiModule = require('@google/generative-ai');

    patchGenerativeModel(genaiModule);

    isInstrumented = true;
    debug('Gemini instrumentation enabled');
  } catch (err) {
    throw new Error(
      'Failed to instrument Gemini. Make sure the "@google/generative-ai" package is installed.'
    );
  }
}

/**
 * Remove instrumentation from the Google Generative AI SDK
 */
export function uninstrument(): void {
  if (!isInstrumented) {
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const genaiModule = require('@google/generative-ai');

    // Restore original methods
    const GenerativeModel = genaiModule.GenerativeModel;
    if (GenerativeModel?.prototype) {
      for (const [key, method] of originalMethods.entries()) {
        // @ts-expect-error - Dynamic property access
        GenerativeModel.prototype[key] = method;
      }
    }

    originalMethods.clear();
    isInstrumented = false;
    debug('Gemini instrumentation disabled');
  } catch {
    // Ignore errors during uninstrumentation
  }
}

/**
 * Patch GenerativeModel methods
 */
function patchGenerativeModel(genaiModule: unknown): void {
  // @ts-expect-error - Accessing module internals
  const GenerativeModel = genaiModule.GenerativeModel;

  if (!GenerativeModel?.prototype) {
    debug('GenerativeModel not found, skipping patch');
    return;
  }

  // Patch generateContent
  if (GenerativeModel.prototype.generateContent) {
    const originalGenerateContent = GenerativeModel.prototype.generateContent;
    originalMethods.set('generateContent', originalGenerateContent);

    GenerativeModel.prototype.generateContent = async function patchedGenerateContent(
      this: { model: string },
      request: string | { contents: Array<unknown>; [key: string]: unknown } | Array<unknown>,
      options?: unknown
    ): Promise<unknown> {
      const client = AgentBasis.getInstance();
      const transport = client.getTransport();

      // Extract model name from instance
      const model = this.model || 'gemini-unknown';
      const startTime = Date.now();

      const span = transport.startLLMSpan(
        `gemini.generateContent`,
        'gemini',
        model
      );

      // Normalize request for logging
      const prompt = typeof request === 'string' ? request : request;

      try {
        const result = await originalGenerateContent.call(this, request, options);
        const durationMs = Date.now() - startTime;

        // Extract usage metadata
        // @ts-expect-error - Accessing Gemini response structure
        const usageMetadata = result.response?.usageMetadata;

        transport.endLLMSpan(span, {
          inputTokens: usageMetadata?.promptTokenCount,
          outputTokens: usageMetadata?.candidatesTokenCount,
          totalTokens: usageMetadata?.totalTokenCount,
          prompt,
          response: result,
          streamed: false,
        });

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        transport.endLLMSpan(span, {
          error,
          prompt,
          streamed: false,
        });
        throw err;
      }
    };
  }

  // Patch generateContentStream
  if (GenerativeModel.prototype.generateContentStream) {
    const originalGenerateContentStream = GenerativeModel.prototype.generateContentStream;
    originalMethods.set('generateContentStream', originalGenerateContentStream);

    GenerativeModel.prototype.generateContentStream = async function patchedGenerateContentStream(
      this: { model: string },
      request: string | { contents: Array<unknown>; [key: string]: unknown } | Array<unknown>,
      options?: unknown
    ): Promise<unknown> {
      const client = AgentBasis.getInstance();
      const transport = client.getTransport();

      const model = this.model || 'gemini-unknown';

      const span = transport.startLLMSpan(
        `gemini.generateContentStream`,
        'gemini',
        model
      );

      const prompt = typeof request === 'string' ? request : request;

      try {
        const result = await originalGenerateContentStream.call(this, request, options);

        // Wrap the stream
        return wrapGeminiStream(result, span, transport, prompt);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        transport.endLLMSpan(span, {
          error,
          prompt,
          streamed: true,
        });
        throw err;
      }
    };
  }

  // Patch startChat and chat methods
  if (GenerativeModel.prototype.startChat) {
    const originalStartChat = GenerativeModel.prototype.startChat;
    originalMethods.set('startChat', originalStartChat);

    GenerativeModel.prototype.startChat = function patchedStartChat(
      this: { model: string },
      params?: unknown
    ): unknown {
      const chat = originalStartChat.call(this, params);

      // Patch the chat's sendMessage method
      if (chat && typeof chat.sendMessage === 'function') {
        const originalSendMessage = chat.sendMessage.bind(chat);

        chat.sendMessage = async function patchedSendMessage(
          request: string | Array<unknown>,
          options?: unknown
        ): Promise<unknown> {
          const client = AgentBasis.getInstance();
          const transport = client.getTransport();

          // @ts-expect-error - Accessing chat internals
          const model = this.model || 'gemini-unknown';
          const startTime = Date.now();

          const span = transport.startLLMSpan(
            `gemini.chat.sendMessage`,
            'gemini',
            model
          );

          try {
            const result = await originalSendMessage(request, options);
            const durationMs = Date.now() - startTime;

            // @ts-expect-error - Accessing Gemini response structure
            const usageMetadata = result.response?.usageMetadata;

            transport.endLLMSpan(span, {
              inputTokens: usageMetadata?.promptTokenCount,
              outputTokens: usageMetadata?.candidatesTokenCount,
              totalTokens: usageMetadata?.totalTokenCount,
              prompt: request,
              response: result,
              streamed: false,
            });

            return result;
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            transport.endLLMSpan(span, {
              error,
              prompt: request,
              streamed: false,
            });
            throw err;
          }
        };

        // Also patch sendMessageStream if it exists
        if (typeof chat.sendMessageStream === 'function') {
          const originalSendMessageStream = chat.sendMessageStream.bind(chat);

          chat.sendMessageStream = async function patchedSendMessageStream(
            request: string | Array<unknown>,
            options?: unknown
          ): Promise<unknown> {
            const client = AgentBasis.getInstance();
            const transport = client.getTransport();

            // @ts-expect-error - Accessing chat internals
            const model = this.model || 'gemini-unknown';

            const span = transport.startLLMSpan(
              `gemini.chat.sendMessageStream`,
              'gemini',
              model
            );

            try {
              const result = await originalSendMessageStream(request, options);
              return wrapGeminiStream(result, span, transport, request);
            } catch (err) {
              const error = err instanceof Error ? err : new Error(String(err));
              transport.endLLMSpan(span, {
                error,
                prompt: request,
                streamed: true,
              });
              throw err;
            }
          };
        }
      }

      return chat;
    };
  }

  // Patch embedContent
  if (GenerativeModel.prototype.embedContent) {
    const originalEmbedContent = GenerativeModel.prototype.embedContent;
    originalMethods.set('embedContent', originalEmbedContent);

    GenerativeModel.prototype.embedContent = async function patchedEmbedContent(
      this: { model: string },
      request: string | { content: unknown; [key: string]: unknown },
      options?: unknown
    ): Promise<unknown> {
      const client = AgentBasis.getInstance();
      const transport = client.getTransport();

      const model = this.model || 'gemini-unknown';
      const startTime = Date.now();

      const span = transport.startLLMSpan(
        `gemini.embedContent`,
        'gemini',
        model
      );

      try {
        const result = await originalEmbedContent.call(this, request, options);
        const durationMs = Date.now() - startTime;

        transport.endLLMSpan(span, {
          prompt: request,
          response: { embedding_dimensions: Array.isArray(result?.embedding?.values) ? result.embedding.values.length : 0 },
          streamed: false,
        });

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        transport.endLLMSpan(span, {
          error,
          prompt: request,
          streamed: false,
        });
        throw err;
      }
    };
  }
}

/**
 * Wrap Gemini stream response
 */
function wrapGeminiStream(
  streamResult: unknown,
  span: ReturnType<typeof AgentBasis.getInstance>['getTransport'] extends () => infer T
    ? T extends { startLLMSpan: (...args: unknown[]) => infer S } ? S : never
    : never,
  transport: ReturnType<typeof AgentBasis.getInstance>['getTransport'] extends () => infer T ? T : never,
  prompt: unknown
): unknown {
  // Gemini returns { stream: AsyncIterable, response: Promise }
  // @ts-expect-error - Accessing stream result structure
  const originalStream = streamResult.stream;
  // @ts-expect-error - Accessing stream result structure
  const responsePromise = streamResult.response;

  if (!originalStream) {
    return streamResult;
  }

  // Create wrapped stream
  const wrappedStream = (async function* (): AsyncGenerator<unknown, void, undefined> {
    let totalText = '';

    try {
      for await (const chunk of originalStream) {
        // @ts-expect-error - Accessing chunk structure
        const text = chunk.text?.();
        if (text) {
          totalText += text;
        }
        yield chunk;
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      transport.endLLMSpan(span, {
        error,
        prompt,
        streamed: true,
      });
      throw err;
    }
  })();

  // Handle the response promise to get final usage
  if (responsePromise && typeof responsePromise.then === 'function') {
    responsePromise
      .then((response: unknown) => {
        // @ts-expect-error - Accessing response structure
        const usageMetadata = response?.usageMetadata;

        transport.endLLMSpan(span, {
          inputTokens: usageMetadata?.promptTokenCount,
          outputTokens: usageMetadata?.candidatesTokenCount,
          totalTokens: usageMetadata?.totalTokenCount,
          prompt,
          response,
          streamed: true,
        });
      })
      .catch((err: Error) => {
        transport.endLLMSpan(span, {
          error: err,
          prompt,
          streamed: true,
        });
      });
  }

  // Return object with wrapped stream
  return {
    stream: wrappedStream,
    response: responsePromise,
  };
}

/**
 * Check if Gemini is instrumented
 */
export function isGeminiInstrumented(): boolean {
  return isInstrumented;
}
