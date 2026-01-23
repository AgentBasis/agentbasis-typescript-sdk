/**
 * TypeScript type definitions for AgentBasis SDK
 */

/**
 * SDK configuration options
 */
export interface AgentBasisConfig {
  /** API key for authentication */
  apiKey: string;

  /** Agent ID to associate telemetry with */
  agentId: string;

  /** Base URL for the AgentBasis API */
  baseUrl: string;

  /** Whether to include prompt/response content in telemetry */
  includeContent: boolean;

  /** Whether to include binary content (images, etc.) */
  includeBinaryContent: boolean;

  /** Number of events to batch before sending */
  batchSize: number;

  /** Interval in milliseconds between automatic flushes */
  flushIntervalMs: number;

  /** Maximum number of retries for failed requests */
  maxRetries: number;

  /** Enable debug logging */
  debug: boolean;
}

/**
 * Trace context for tagging telemetry
 */
export interface TraceContext {
  /** Unique trace ID */
  traceId?: string;

  /** Parent span ID */
  parentSpanId?: string;

  /** Custom metadata */
  [key: string]: unknown;
}

/**
 * Base telemetry event
 */
export interface TelemetryEvent {
  /** Event type */
  type: 'llm_call' | 'span' | 'log' | 'error';

  /** Timestamp in ISO format */
  timestamp: string;

  /** Trace context */
  context?: TraceContext;
}

/**
 * LLM call telemetry event
 */
export interface LLMCallEvent extends TelemetryEvent {
  type: 'llm_call';

  /** LLM provider (openai, anthropic, gemini) */
  provider: string;

  /** Model name */
  model: string;

  /** Request duration in milliseconds */
  durationMs: number;

  /** Input tokens */
  inputTokens?: number;

  /** Output tokens */
  outputTokens?: number;

  /** Total tokens */
  totalTokens?: number;

  /** Prompt content (if includeContent is true) */
  prompt?: unknown;

  /** Response content (if includeContent is true) */
  response?: unknown;

  /** Error message if the call failed */
  error?: string;

  /** Whether the response was streamed */
  streamed: boolean;
}

/**
 * Span event for custom function tracing
 */
export interface SpanEvent extends TelemetryEvent {
  type: 'span';

  /** Span name */
  name: string;

  /** Span duration in milliseconds */
  durationMs: number;

  /** Input arguments (if includeContent is true) */
  input?: unknown;

  /** Output result (if includeContent is true) */
  output?: unknown;

  /** Error message if the span failed */
  error?: string;
}
