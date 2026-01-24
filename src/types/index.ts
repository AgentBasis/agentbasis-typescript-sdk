/**
 * TypeScript type definitions for AgentBasis SDK
 */

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Full SDK configuration (internal use)
 */
export interface AgentBasisConfig {
  /** API key for authentication */
  apiKey: string;

  /** Agent ID to associate telemetry with */
  agentId: string;

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
 * Configuration options passed to init()
 * All fields are optional - will use env vars and defaults
 */
export interface InitConfig {
  /** API key (defaults to AGENTBASIS_API_KEY env var) */
  apiKey?: string;

  /** Agent ID (defaults to AGENTBASIS_AGENT_ID env var) */
  agentId?: string;

  /** Whether to include prompt/response content (default: false) */
  includeContent?: boolean;

  /** Whether to include binary content like images (default: false) */
  includeBinaryContent?: boolean;

  /** Number of events to batch before sending (default: 100) */
  batchSize?: number;

  /** Interval in ms between automatic flushes (default: 5000) */
  flushIntervalMs?: number;

  /** Maximum retries for failed requests (default: 3) */
  maxRetries?: number;

  /** Enable debug logging (default: false) */
  debug?: boolean;
}

// ============================================================================
// Context Types
// ============================================================================

/**
 * Trace context for tagging telemetry
 */
export interface TraceContext {
  /** Unique trace ID */
  traceId?: string;

  /** Span ID */
  spanId?: string;

  /** Parent span ID for nested traces */
  parentSpanId?: string;

  /** User ID for user-level tracking */
  userId?: string;

  /** Session ID for session-level tracking */
  sessionId?: string;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Telemetry Event Types
// ============================================================================

/**
 * Event types
 */
export type EventType = 'llm_call' | 'span' | 'log' | 'error';

/**
 * LLM provider types
 */
export type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'other';

/**
 * Base telemetry event
 */
export interface BaseTelemetryEvent {
  /** Event type */
  type: EventType;

  /** Timestamp in ISO format */
  timestamp: string;

  /** Agent ID */
  agentId: string;

  /** Trace context */
  context?: TraceContext;
}

/**
 * LLM call telemetry event
 */
export interface LLMCallEvent extends BaseTelemetryEvent {
  type: 'llm_call';

  /** LLM provider */
  provider: LLMProvider;

  /** Model name (e.g., 'gpt-4', 'claude-3-opus') */
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

  /** Whether the response was streamed */
  streamed: boolean;

  /** Error message if the call failed */
  error?: string;

  /** HTTP status code if applicable */
  statusCode?: number;
}

/**
 * Span event for custom function tracing
 */
export interface SpanEvent extends BaseTelemetryEvent {
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

/**
 * Log event
 */
export interface LogEvent extends BaseTelemetryEvent {
  type: 'log';

  /** Log level */
  level: 'debug' | 'info' | 'warn' | 'error';

  /** Log message */
  message: string;

  /** Additional data */
  data?: unknown;
}

/**
 * Error event
 */
export interface ErrorEvent extends BaseTelemetryEvent {
  type: 'error';

  /** Error message */
  message: string;

  /** Error stack trace */
  stack?: string;

  /** Error name/type */
  name?: string;
}

/**
 * Union of all telemetry event types
 */
export type TelemetryEvent = LLMCallEvent | SpanEvent | LogEvent | ErrorEvent;

// ============================================================================
// API Types
// ============================================================================

/**
 * Batch payload sent to AgentBasis API
 */
export interface TelemetryBatch {
  /** Events in this batch */
  events: TelemetryEvent[];

  /** SDK version */
  sdkVersion: string;

  /** SDK language */
  sdkLanguage: 'typescript';

  /** Batch timestamp */
  timestamp: string;
}

/**
 * API response
 */
export interface APIResponse {
  /** Whether the request was successful */
  success: boolean;

  /** Error message if failed */
  error?: string;
}
