/**
 * Context and trace management for AgentBasis SDK
 */

import { context, trace, SpanStatusCode, type Span, type Context } from '@opentelemetry/api';
import type { TraceContext } from '../types';
import { AgentBasis } from './client';
import { debug } from '../utils/logger';

/** Context key for storing AgentBasis trace context */
const AGENTBASIS_CONTEXT_KEY = 'agentbasis.context';

/**
 * Create a new context with AgentBasis metadata
 */
function createContextWithMetadata(
  parentContext: Context,
  metadata: TraceContext
): Context {
  // Store metadata in context for later retrieval
  return parentContext.setValue(Symbol.for(AGENTBASIS_CONTEXT_KEY), metadata);
}

/**
 * Get AgentBasis metadata from context
 */
function getMetadataFromContext(ctx: Context): TraceContext | undefined {
  return ctx.getValue(Symbol.for(AGENTBASIS_CONTEXT_KEY)) as TraceContext | undefined;
}

/**
 * Execute a function within a trace context
 *
 * All LLM calls and spans within this context will be tagged with the provided metadata.
 *
 * @param traceContext - Metadata to attach to all spans in this context
 * @param fn - Function to execute within the context
 * @returns The result of the function
 *
 * @example
 * ```typescript
 * import { withContext } from 'agentbasis';
 *
 * await withContext({ userId: '123', sessionId: 'abc' }, async () => {
 *   // All LLM calls here will be tagged with userId and sessionId
 *   await openai.chat.completions.create({...});
 * });
 * ```
 */
export async function withContext<T>(
  traceContext: TraceContext,
  fn: () => T | Promise<T>
): Promise<T> {
  if (!AgentBasis.isInitialized()) {
    return fn();
  }

  const client = AgentBasis.getInstance();
  const transport = client.getTransport();
  const tracer = transport.getTracer();

  // Merge with any existing context
  const parentContext = context.active();
  const existingMetadata = getMetadataFromContext(parentContext);
  const mergedMetadata: TraceContext = {
    ...existingMetadata,
    ...traceContext,
  };

  // Create a span for this context
  const spanName = traceContext.traceId ?? 'context';
  const span = tracer.startSpan(spanName, undefined, parentContext);

  // Add metadata as span attributes
  if (mergedMetadata.userId) {
    span.setAttribute('user.id', mergedMetadata.userId);
  }
  if (mergedMetadata.sessionId) {
    span.setAttribute('session.id', mergedMetadata.sessionId);
  }
  if (mergedMetadata.traceId) {
    span.setAttribute('agentbasis.trace_id', mergedMetadata.traceId);
  }
  if (mergedMetadata.metadata) {
    for (const [key, value] of Object.entries(mergedMetadata.metadata)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        span.setAttribute(`agentbasis.metadata.${key}`, value);
      }
    }
  }

  // Create new context with span and metadata
  const newContext = createContextWithMetadata(
    trace.setSpan(parentContext, span),
    mergedMetadata
  );

  try {
    const result = await context.with(newContext, async () => {
      return await fn();
    });

    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    span.recordException(error);
    throw err;
  } finally {
    span.end();
  }
}

/**
 * Wrap a function with tracing
 *
 * Creates a span each time the function is called.
 *
 * @param name - Name for the span
 * @param fn - Function to wrap
 * @returns Wrapped function that creates spans on each call
 *
 * @example
 * ```typescript
 * import { trace } from 'agentbasis';
 *
 * const processData = trace('processData', async (input: string) => {
 *   // Function execution is tracked as a span
 *   return transformedData;
 * });
 *
 * // Each call creates a new span
 * await processData('hello');
 * ```
 */
export function traceFunction<TArgs extends unknown[], TReturn>(
  name: string,
  fn: (...args: TArgs) => TReturn
): (...args: TArgs) => TReturn {
  return ((...args: TArgs): TReturn => {
    if (!AgentBasis.isInitialized()) {
      // If SDK not initialized, just run the function
      return fn(...args);
    }

    const client = AgentBasis.getInstance();
    const transport = client.getTransport();
    const span = transport.startSpan(name);

    // Get current context metadata
    const currentContext = context.active();
    const metadata = getMetadataFromContext(currentContext);

    // Add context metadata to span
    if (metadata?.userId) {
      span.setAttribute('user.id', metadata.userId);
    }
    if (metadata?.sessionId) {
      span.setAttribute('session.id', metadata.sessionId);
    }

    const handleResult = (result: TReturn): TReturn => {
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      return result;
    };

    const handleError = (err: unknown): never => {
      const error = err instanceof Error ? err : new Error(String(err));
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
      span.end();
      throw err;
    };

    try {
      const result = fn(...args);

      // Handle async functions
      if (result instanceof Promise) {
        return result.then(handleResult).catch(handleError) as TReturn;
      }

      return handleResult(result);
    } catch (err) {
      return handleError(err);
    }
  }) as (...args: TArgs) => TReturn;
}

// Export as 'trace' for cleaner API
export { traceFunction as trace };

/**
 * Get the current trace context
 *
 * @returns The current context metadata, or undefined if not in a context
 */
export function getCurrentContext(): TraceContext | undefined {
  const ctx = context.active();
  return getMetadataFromContext(ctx);
}

/**
 * Get the current span
 *
 * @returns The current active span, or undefined if none
 */
export function getCurrentSpan(): Span | undefined {
  return trace.getActiveSpan();
}

/**
 * Add attributes to the current span
 *
 * @param attributes - Key-value pairs to add
 */
export function addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
  const span = getCurrentSpan();
  if (span) {
    for (const [key, value] of Object.entries(attributes)) {
      span.setAttribute(key, value);
    }
  }
}

/**
 * Record an error on the current span
 *
 * @param error - Error to record
 */
export function recordError(error: Error): void {
  const span = getCurrentSpan();
  if (span) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  }
}
