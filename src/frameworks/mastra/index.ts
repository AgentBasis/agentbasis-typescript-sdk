/**
 * Mastra framework integration for AgentBasis
 *
 * Provides utilities for tracking Mastra agent operations.
 *
 * @example
 * ```typescript
 * import { AgentBasis } from 'agentbasis';
 * import { createTracedAgent, withAgentTracing } from 'agentbasis/frameworks/mastra';
 *
 * AgentBasis.init();
 *
 * // Option 1: Create a traced agent
 * const agent = createTracedAgent({
 *   name: 'my-agent',
 *   // ... other mastra config
 * });
 *
 * // Option 2: Wrap existing agent
 * const tracedAgent = withAgentTracing(existingAgent);
 *
 * // Option 3: Track agent execution manually
 * const result = await trackAgentExecution('my-agent', async () => {
 *   return agent.execute(input);
 * });
 * ```
 */

import { AgentBasis } from '../../core/client';
import { debug, warn } from '../../utils/logger';
import type { Span } from '@opentelemetry/api';

/**
 * Mastra Agent interface (simplified)
 */
interface MastraAgent {
  name?: string;
  execute?: (input: unknown, options?: unknown) => Promise<unknown>;
  run?: (input: unknown, options?: unknown) => Promise<unknown>;
  invoke?: (input: unknown, options?: unknown) => Promise<unknown>;
  [key: string]: unknown;
}

/**
 * Mastra Agent configuration
 */
interface MastraAgentConfig {
  name?: string;
  description?: string;
  model?: unknown;
  tools?: unknown[];
  [key: string]: unknown;
}

/**
 * Create a Mastra agent with AgentBasis tracing built-in
 *
 * @param config - Mastra agent configuration
 * @returns Traced agent (requires Mastra to be installed)
 *
 * @example
 * ```typescript
 * const agent = createTracedAgent({
 *   name: 'research-agent',
 *   model: openai('gpt-4'),
 *   tools: [searchTool, browseTool],
 * });
 * ```
 */
export function createTracedAgent<T extends MastraAgentConfig>(config: T): T & { __traced: true } {
  if (!AgentBasis.isInitialized()) {
    warn('AgentBasis not initialized. Agent will not be traced.');
    return { ...config, __traced: true as const };
  }

  try {
    // Try to import Mastra dynamically
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mastra = require('@mastra/core');

    // If Mastra has an Agent class, extend it
    if (mastra.Agent) {
      const originalAgent = new mastra.Agent(config);
      return withAgentTracing(originalAgent) as T & { __traced: true };
    }

    // Otherwise, just add tracing metadata to config
    debug('Mastra Agent class not found, returning config with tracing metadata');
    return { ...config, __traced: true as const };
  } catch {
    // Mastra not installed, return config with tracing flag
    debug('Mastra not installed, returning config with tracing metadata');
    return { ...config, __traced: true as const };
  }
}

/**
 * Wrap an existing Mastra agent with AgentBasis tracing
 *
 * @param agent - The Mastra agent to wrap
 * @returns Wrapped agent with tracing
 *
 * @example
 * ```typescript
 * import { Agent } from '@mastra/core';
 *
 * const agent = new Agent({ name: 'my-agent', ... });
 * const tracedAgent = withAgentTracing(agent);
 * ```
 */
export function withAgentTracing<T extends MastraAgent>(agent: T): T {
  if (!AgentBasis.isInitialized()) {
    warn('AgentBasis not initialized. Agent will not be traced.');
    return agent;
  }

  const agentName = agent.name || 'mastra-agent';
  const wrappedAgent = Object.create(agent);

  // Wrap execute method
  if (typeof agent.execute === 'function') {
    const originalExecute = agent.execute.bind(agent);

    wrappedAgent.execute = async function tracedExecute(
      input: unknown,
      options?: unknown
    ): Promise<unknown> {
      return trackAgentExecution(agentName, async () => {
        return originalExecute(input, options);
      }, { input });
    };
  }

  // Wrap run method (alternative name some frameworks use)
  if (typeof agent.run === 'function') {
    const originalRun = agent.run.bind(agent);

    wrappedAgent.run = async function tracedRun(
      input: unknown,
      options?: unknown
    ): Promise<unknown> {
      return trackAgentExecution(agentName, async () => {
        return originalRun(input, options);
      }, { input });
    };
  }

  // Wrap invoke method (another alternative)
  if (typeof agent.invoke === 'function') {
    const originalInvoke = agent.invoke.bind(agent);

    wrappedAgent.invoke = async function tracedInvoke(
      input: unknown,
      options?: unknown
    ): Promise<unknown> {
      return trackAgentExecution(agentName, async () => {
        return originalInvoke(input, options);
      }, { input });
    };
  }

  return wrappedAgent as T;
}

/**
 * Track a Mastra agent execution
 *
 * Use this for manual tracking of agent operations.
 *
 * @param agentName - Name of the agent
 * @param fn - Async function that runs the agent
 * @param metadata - Optional metadata to include
 * @returns Result of the agent execution
 *
 * @example
 * ```typescript
 * const result = await trackAgentExecution('my-agent', async () => {
 *   return agent.execute({ task: 'research topic' });
 * });
 * ```
 */
export async function trackAgentExecution<T>(
  agentName: string,
  fn: () => Promise<T>,
  metadata?: { input?: unknown; [key: string]: unknown }
): Promise<T> {
  if (!AgentBasis.isInitialized()) {
    return fn();
  }

  const transport = AgentBasis.getInstance().getTransport();
  const startTime = Date.now();

  const span = transport.startSpan(`mastra.agent.${agentName}`);
  span.setAttribute('mastra.agent_name', agentName);

  const config = AgentBasis.getConfig();
  if (config?.includeContent && metadata?.input) {
    span.setAttribute('mastra.input', JSON.stringify(metadata.input));
  }

  // Add any additional metadata
  if (metadata) {
    for (const [key, value] of Object.entries(metadata)) {
      if (key !== 'input' && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) {
        span.setAttribute(`mastra.${key}`, value);
      }
    }
  }

  try {
    const result = await fn();
    const durationMs = Date.now() - startTime;

    span.setAttribute('mastra.duration_ms', durationMs);

    if (config?.includeContent && result !== undefined) {
      span.setAttribute('mastra.output', JSON.stringify(result));
    }

    span.end();
    debug(`Agent ${agentName} completed in ${durationMs}ms`);

    return result;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    span.recordException(error);
    span.setAttribute('mastra.error', error.message);
    span.end();

    debug(`Agent ${agentName} failed: ${error.message}`);
    throw err;
  }
}

/**
 * Track a Mastra tool execution
 *
 * @param toolName - Name of the tool
 * @param fn - Async function that runs the tool
 * @param input - Tool input
 * @returns Result of the tool execution
 *
 * @example
 * ```typescript
 * const result = await trackToolExecution('search', async () => {
 *   return searchTool.execute({ query: 'AI news' });
 * }, { query: 'AI news' });
 * ```
 */
export async function trackToolExecution<T>(
  toolName: string,
  fn: () => Promise<T>,
  input?: unknown
): Promise<T> {
  if (!AgentBasis.isInitialized()) {
    return fn();
  }

  const transport = AgentBasis.getInstance().getTransport();
  const startTime = Date.now();

  const span = transport.startSpan(`mastra.tool.${toolName}`);
  span.setAttribute('mastra.tool_name', toolName);

  const config = AgentBasis.getConfig();
  if (config?.includeContent && input !== undefined) {
    span.setAttribute('mastra.tool_input', JSON.stringify(input));
  }

  try {
    const result = await fn();
    const durationMs = Date.now() - startTime;

    span.setAttribute('mastra.duration_ms', durationMs);

    if (config?.includeContent && result !== undefined) {
      span.setAttribute('mastra.tool_output', JSON.stringify(result));
    }

    span.end();
    return result;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    span.recordException(error);
    span.end();
    throw err;
  }
}

/**
 * Track a Mastra workflow step
 *
 * @param stepName - Name of the workflow step
 * @param fn - Async function that runs the step
 * @returns Result of the step
 *
 * @example
 * ```typescript
 * const result = await trackWorkflowStep('validate-input', async () => {
 *   return validateUserInput(input);
 * });
 * ```
 */
export async function trackWorkflowStep<T>(
  stepName: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!AgentBasis.isInitialized()) {
    return fn();
  }

  const transport = AgentBasis.getInstance().getTransport();
  const startTime = Date.now();

  const span = transport.startSpan(`mastra.workflow.${stepName}`);
  span.setAttribute('mastra.step_name', stepName);

  try {
    const result = await fn();
    const durationMs = Date.now() - startTime;

    span.setAttribute('mastra.duration_ms', durationMs);
    span.end();

    return result;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    span.recordException(error);
    span.end();
    throw err;
  }
}

/**
 * Create a traced tool wrapper
 *
 * @param name - Tool name
 * @param tool - Tool function
 * @returns Wrapped tool with tracing
 *
 * @example
 * ```typescript
 * const searchTool = createTracedTool('search', async (query: string) => {
 *   return performSearch(query);
 * });
 * ```
 */
export function createTracedTool<TInput, TOutput>(
  name: string,
  tool: (input: TInput) => Promise<TOutput>
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput): Promise<TOutput> => {
    return trackToolExecution(name, () => tool(input), input);
  };
}
