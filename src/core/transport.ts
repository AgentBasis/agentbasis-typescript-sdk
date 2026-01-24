/**
 * OpenTelemetry transport layer for sending telemetry to AgentBasis API
 */

import {
  trace,
  context,
  SpanKind,
  SpanStatusCode,
  type Tracer,
  type Span,
  type Context,
} from '@opentelemetry/api';
import { BasicTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

import type { AgentBasisConfig } from '../types';
import { AGENTBASIS_API_URL } from '../utils/env';
import { debug, error as logError } from '../utils/logger';

/** SDK version - should match package.json */
const SDK_VERSION = '0.1.0';

/** Custom semantic conventions for LLM tracing */
export const LLM_ATTRIBUTES = {
  PROVIDER: 'llm.provider',
  MODEL: 'llm.model',
  INPUT_TOKENS: 'llm.usage.input_tokens',
  OUTPUT_TOKENS: 'llm.usage.output_tokens',
  TOTAL_TOKENS: 'llm.usage.total_tokens',
  PROMPT: 'llm.prompt',
  RESPONSE: 'llm.response',
  STREAMED: 'llm.streamed',
  AGENT_ID: 'agentbasis.agent_id',
} as const;

/**
 * Transport class for sending telemetry via OpenTelemetry
 */
export class Transport {
  private config: AgentBasisConfig;
  private provider: BasicTracerProvider;
  private tracer: Tracer;
  private exporter: OTLPTraceExporter;

  constructor(config: AgentBasisConfig) {
    this.config = config;

    // Create OTLP exporter pointing to AgentBasis API
    this.exporter = new OTLPTraceExporter({
      url: `${AGENTBASIS_API_URL}/v1/traces`,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'X-Agent-ID': config.agentId,
      },
    });

    // Create resource with service info
    const resource = new Resource({
      [ATTR_SERVICE_NAME]: 'agentbasis-sdk',
      [ATTR_SERVICE_VERSION]: SDK_VERSION,
      [LLM_ATTRIBUTES.AGENT_ID]: config.agentId,
    });

    // Create tracer provider with batch processor
    this.provider = new BasicTracerProvider({
      resource,
    });

    // Add batch processor for efficient sending
    this.provider.addSpanProcessor(
      new BatchSpanProcessor(this.exporter, {
        maxQueueSize: config.batchSize * 10,
        maxExportBatchSize: config.batchSize,
        scheduledDelayMillis: config.flushIntervalMs,
      })
    );

    // Register the provider
    this.provider.register();

    // Get tracer instance
    this.tracer = trace.getTracer('agentbasis', SDK_VERSION);

    debug('Transport initialized with OTLP exporter');
  }

  /**
   * Get the tracer for creating spans
   */
  getTracer(): Tracer {
    return this.tracer;
  }

  /**
   * Start a new span for an LLM call
   */
  startLLMSpan(
    name: string,
    provider: string,
    model: string,
    parentContext?: Context
  ): Span {
    const ctx = parentContext ?? context.active();

    const span = this.tracer.startSpan(
      name,
      {
        kind: SpanKind.CLIENT,
        attributes: {
          [LLM_ATTRIBUTES.PROVIDER]: provider,
          [LLM_ATTRIBUTES.MODEL]: model,
          [LLM_ATTRIBUTES.AGENT_ID]: this.config.agentId,
        },
      },
      ctx
    );

    return span;
  }

  /**
   * End an LLM span with results
   */
  endLLMSpan(
    span: Span,
    options: {
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
      prompt?: unknown;
      response?: unknown;
      streamed?: boolean;
      error?: Error;
    }
  ): void {
    if (options.inputTokens !== undefined) {
      span.setAttribute(LLM_ATTRIBUTES.INPUT_TOKENS, options.inputTokens);
    }
    if (options.outputTokens !== undefined) {
      span.setAttribute(LLM_ATTRIBUTES.OUTPUT_TOKENS, options.outputTokens);
    }
    if (options.totalTokens !== undefined) {
      span.setAttribute(LLM_ATTRIBUTES.TOTAL_TOKENS, options.totalTokens);
    }
    if (options.streamed !== undefined) {
      span.setAttribute(LLM_ATTRIBUTES.STREAMED, options.streamed);
    }

    // Only include content if configured
    if (this.config.includeContent) {
      if (options.prompt !== undefined) {
        span.setAttribute(LLM_ATTRIBUTES.PROMPT, JSON.stringify(options.prompt));
      }
      if (options.response !== undefined) {
        span.setAttribute(LLM_ATTRIBUTES.RESPONSE, JSON.stringify(options.response));
      }
    }

    if (options.error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: options.error.message,
      });
      span.recordException(options.error);
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    span.end();
  }

  /**
   * Start a custom span
   */
  startSpan(name: string, parentContext?: Context): Span {
    const ctx = parentContext ?? context.active();

    return this.tracer.startSpan(
      name,
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          [LLM_ATTRIBUTES.AGENT_ID]: this.config.agentId,
        },
      },
      ctx
    );
  }

  /**
   * Execute a function within a span context
   */
  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T> | T
  ): Promise<T> {
    const span = this.startSpan(name);

    try {
      const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
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
   * Force flush all pending spans
   */
  async flush(_timeoutMillis?: number): Promise<boolean> {
    try {
      await this.provider.forceFlush();
      debug('Telemetry flushed successfully');
      return true;
    } catch (err) {
      logError('Failed to flush telemetry', err);
      return false;
    }
  }

  /**
   * Start auto-flush (handled by BatchSpanProcessor)
   */
  startAutoFlush(): void {
    // BatchSpanProcessor handles this automatically
    debug('Auto-flush enabled via BatchSpanProcessor');
  }

  /**
   * Stop auto-flush
   */
  stopAutoFlush(): void {
    // BatchSpanProcessor handles this - nothing to do here
  }

  /**
   * Shutdown the transport
   */
  async shutdown(): Promise<void> {
    try {
      await this.provider.shutdown();
      debug('Transport shutdown complete');
    } catch (err) {
      logError('Error during transport shutdown', err);
    }
  }

  /**
   * Legacy method for compatibility - enqueue event
   * Converts to span-based approach
   */
  enqueue(): void {
    // Events are now tracked via spans
    // This method is kept for backward compatibility
    debug('enqueue() called - use startSpan/endSpan instead');
  }
}

/**
 * Get the current active context
 */
export function getActiveContext(): Context {
  return context.active();
}

/**
 * Run a function with a specific context
 */
export function withContext<T>(ctx: Context, fn: () => T): T {
  return context.with(ctx, fn);
}
