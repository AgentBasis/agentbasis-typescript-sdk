/**
 * LangChain.js integration for AgentBasis
 *
 * Provides a callback handler for tracking LangChain operations.
 *
 * @example
 * ```typescript
 * import { AgentBasis } from 'agentbasis';
 * import { AgentBasisCallbackHandler } from 'agentbasis/frameworks/langchain';
 *
 * AgentBasis.init();
 *
 * const handler = new AgentBasisCallbackHandler();
 *
 * // Use with any LangChain component
 * const llm = new ChatOpenAI({
 *   callbacks: [handler],
 * });
 *
 * // Or pass to invoke
 * await chain.invoke({ input: 'Hello' }, { callbacks: [handler] });
 * ```
 */

import { AgentBasis } from '../../core/client';
import { debug, warn } from '../../utils/logger';
import type { Span } from '@opentelemetry/api';

/** Serialized representation from LangChain */
interface Serialized {
  lc: number;
  type: string;
  id: string[];
  name?: string;
}

/** LLM result from LangChain */
interface LLMResult {
  generations: Array<Array<{ text: string; [key: string]: unknown }>>;
  llmOutput?: {
    tokenUsage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
    [key: string]: unknown;
  };
}

/** Chain values */
interface ChainValues {
  [key: string]: unknown;
}

/** Agent action */
interface AgentAction {
  tool: string;
  toolInput: string | Record<string, unknown>;
  log: string;
}

/** Agent finish */
interface AgentFinish {
  returnValues: Record<string, unknown>;
  log: string;
}

/** Run info passed to callbacks */
interface RunInfo {
  runId?: string;
  parentRunId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * AgentBasis callback handler for LangChain.js
 *
 * Tracks LLM calls, chains, agents, and tools.
 */
export class AgentBasisCallbackHandler {
  /** Handler name for LangChain */
  name = 'AgentBasisCallbackHandler';

  /** Map of run IDs to spans */
  private spans: Map<string, Span> = new Map();

  /** Map of run IDs to start times */
  private startTimes: Map<string, number> = new Map();

  /** Whether the handler is enabled (SDK is initialized) */
  private enabled: boolean;

  constructor() {
    this.enabled = AgentBasis.isInitialized();
    if (!this.enabled) {
      warn('AgentBasis not initialized. Callbacks will be no-ops. Call AgentBasis.init() first.');
    }
  }

  // =========================================================================
  // LLM Callbacks
  // =========================================================================

  /**
   * Called when LLM starts running
   */
  async handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.enabled) return;

    const transport = AgentBasis.getInstance().getTransport();
    const modelName = llm.name || llm.id?.join('/') || 'unknown';

    const span = transport.startLLMSpan(
      `langchain.llm`,
      'langchain',
      modelName
    );

    // Add metadata
    span.setAttribute('langchain.run_id', runId);
    if (parentRunId) {
      span.setAttribute('langchain.parent_run_id', parentRunId);
    }
    if (tags?.length) {
      span.setAttribute('langchain.tags', tags.join(','));
    }

    this.spans.set(runId, span);
    this.startTimes.set(runId, Date.now());

    debug(`LLM started: ${modelName}`, { runId });
  }

  /**
   * Called when LLM finishes
   */
  async handleLLMEnd(
    output: LLMResult,
    runId: string,
    parentRunId?: string,
    tags?: string[]
  ): Promise<void> {
    if (!this.enabled) return;

    const span = this.spans.get(runId);
    if (!span) return;

    const transport = AgentBasis.getInstance().getTransport();
    const tokenUsage = output.llmOutput?.tokenUsage;

    transport.endLLMSpan(span, {
      inputTokens: tokenUsage?.promptTokens,
      outputTokens: tokenUsage?.completionTokens,
      totalTokens: tokenUsage?.totalTokens,
      response: output.generations,
      streamed: false,
    });

    this.spans.delete(runId);
    this.startTimes.delete(runId);

    debug('LLM ended', { runId });
  }

  /**
   * Called when LLM errors
   */
  async handleLLMError(
    error: Error,
    runId: string,
    parentRunId?: string,
    tags?: string[]
  ): Promise<void> {
    if (!this.enabled) return;

    const span = this.spans.get(runId);
    if (!span) return;

    const transport = AgentBasis.getInstance().getTransport();

    transport.endLLMSpan(span, {
      error,
      streamed: false,
    });

    this.spans.delete(runId);
    this.startTimes.delete(runId);

    debug('LLM error', { runId, error: error.message });
  }

  // =========================================================================
  // Chat Model Callbacks
  // =========================================================================

  /**
   * Called when chat model starts
   */
  async handleChatModelStart(
    llm: Serialized,
    messages: Array<Array<{ role?: string; content: string; [key: string]: unknown }>>,
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.enabled) return;

    const transport = AgentBasis.getInstance().getTransport();
    const modelName = llm.name || llm.id?.join('/') || 'unknown';

    const span = transport.startLLMSpan(
      `langchain.chat`,
      'langchain',
      modelName
    );

    span.setAttribute('langchain.run_id', runId);
    if (parentRunId) {
      span.setAttribute('langchain.parent_run_id', parentRunId);
    }

    this.spans.set(runId, span);
    this.startTimes.set(runId, Date.now());

    debug(`Chat model started: ${modelName}`, { runId });
  }

  // =========================================================================
  // Chain Callbacks
  // =========================================================================

  /**
   * Called when chain starts
   */
  async handleChainStart(
    chain: Serialized,
    inputs: ChainValues,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.enabled) return;

    const transport = AgentBasis.getInstance().getTransport();
    const chainName = chain.name || chain.id?.join('/') || 'unknown';

    const span = transport.startSpan(`langchain.chain.${chainName}`);

    span.setAttribute('langchain.chain_name', chainName);
    span.setAttribute('langchain.run_id', runId);
    if (parentRunId) {
      span.setAttribute('langchain.parent_run_id', parentRunId);
    }

    this.spans.set(runId, span);
    this.startTimes.set(runId, Date.now());

    debug(`Chain started: ${chainName}`, { runId });
  }

  /**
   * Called when chain finishes
   */
  async handleChainEnd(
    outputs: ChainValues,
    runId: string,
    parentRunId?: string,
    tags?: string[]
  ): Promise<void> {
    if (!this.enabled) return;

    const span = this.spans.get(runId);
    if (!span) return;

    const config = AgentBasis.getConfig();
    if (config?.includeContent) {
      span.setAttribute('langchain.outputs', JSON.stringify(outputs));
    }

    span.end();

    this.spans.delete(runId);
    this.startTimes.delete(runId);

    debug('Chain ended', { runId });
  }

  /**
   * Called when chain errors
   */
  async handleChainError(
    error: Error,
    runId: string,
    parentRunId?: string,
    tags?: string[]
  ): Promise<void> {
    if (!this.enabled) return;

    const span = this.spans.get(runId);
    if (!span) return;

    span.recordException(error);
    span.end();

    this.spans.delete(runId);
    this.startTimes.delete(runId);

    debug('Chain error', { runId, error: error.message });
  }

  // =========================================================================
  // Agent Callbacks
  // =========================================================================

  /**
   * Called when agent takes an action
   */
  async handleAgentAction(
    action: AgentAction,
    runId: string,
    parentRunId?: string,
    tags?: string[]
  ): Promise<void> {
    if (!this.enabled) return;

    const transport = AgentBasis.getInstance().getTransport();

    const span = transport.startSpan(`langchain.agent.action.${action.tool}`);
    span.setAttribute('langchain.tool', action.tool);
    span.setAttribute('langchain.run_id', runId);

    const config = AgentBasis.getConfig();
    if (config?.includeContent) {
      span.setAttribute('langchain.tool_input', JSON.stringify(action.toolInput));
    }

    // Store with a unique key for agent actions
    this.spans.set(`${runId}_action_${action.tool}`, span);

    debug(`Agent action: ${action.tool}`, { runId });
  }

  /**
   * Called when agent finishes
   */
  async handleAgentEnd(
    finish: AgentFinish,
    runId: string,
    parentRunId?: string,
    tags?: string[]
  ): Promise<void> {
    if (!this.enabled) return;

    // End any remaining action spans for this run
    for (const [key, span] of this.spans.entries()) {
      if (key.startsWith(`${runId}_action_`)) {
        span.end();
        this.spans.delete(key);
      }
    }

    debug('Agent ended', { runId });
  }

  // =========================================================================
  // Tool Callbacks
  // =========================================================================

  /**
   * Called when tool starts
   */
  async handleToolStart(
    tool: Serialized,
    input: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.enabled) return;

    const transport = AgentBasis.getInstance().getTransport();
    const toolName = tool.name || tool.id?.join('/') || 'unknown';

    const span = transport.startSpan(`langchain.tool.${toolName}`);
    span.setAttribute('langchain.tool_name', toolName);
    span.setAttribute('langchain.run_id', runId);

    const config = AgentBasis.getConfig();
    if (config?.includeContent) {
      span.setAttribute('langchain.tool_input', input);
    }

    this.spans.set(runId, span);
    this.startTimes.set(runId, Date.now());

    debug(`Tool started: ${toolName}`, { runId });
  }

  /**
   * Called when tool finishes
   */
  async handleToolEnd(
    output: string,
    runId: string,
    parentRunId?: string,
    tags?: string[]
  ): Promise<void> {
    if (!this.enabled) return;

    const span = this.spans.get(runId);
    if (!span) return;

    const config = AgentBasis.getConfig();
    if (config?.includeContent) {
      span.setAttribute('langchain.tool_output', output);
    }

    span.end();

    this.spans.delete(runId);
    this.startTimes.delete(runId);

    debug('Tool ended', { runId });
  }

  /**
   * Called when tool errors
   */
  async handleToolError(
    error: Error,
    runId: string,
    parentRunId?: string,
    tags?: string[]
  ): Promise<void> {
    if (!this.enabled) return;

    const span = this.spans.get(runId);
    if (!span) return;

    span.recordException(error);
    span.end();

    this.spans.delete(runId);
    this.startTimes.delete(runId);

    debug('Tool error', { runId, error: error.message });
  }

  // =========================================================================
  // Retriever Callbacks
  // =========================================================================

  /**
   * Called when retriever starts
   */
  async handleRetrieverStart(
    retriever: Serialized,
    query: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.enabled) return;

    const transport = AgentBasis.getInstance().getTransport();
    const retrieverName = retriever.name || retriever.id?.join('/') || 'unknown';

    const span = transport.startSpan(`langchain.retriever.${retrieverName}`);
    span.setAttribute('langchain.retriever_name', retrieverName);
    span.setAttribute('langchain.run_id', runId);

    const config = AgentBasis.getConfig();
    if (config?.includeContent) {
      span.setAttribute('langchain.query', query);
    }

    this.spans.set(runId, span);
    this.startTimes.set(runId, Date.now());

    debug(`Retriever started: ${retrieverName}`, { runId });
  }

  /**
   * Called when retriever finishes
   */
  async handleRetrieverEnd(
    documents: Array<{ pageContent: string; metadata: Record<string, unknown> }>,
    runId: string,
    parentRunId?: string,
    tags?: string[]
  ): Promise<void> {
    if (!this.enabled) return;

    const span = this.spans.get(runId);
    if (!span) return;

    span.setAttribute('langchain.document_count', documents.length);

    span.end();

    this.spans.delete(runId);
    this.startTimes.delete(runId);

    debug('Retriever ended', { runId, documentCount: documents.length });
  }

  /**
   * Called when retriever errors
   */
  async handleRetrieverError(
    error: Error,
    runId: string,
    parentRunId?: string,
    tags?: string[]
  ): Promise<void> {
    if (!this.enabled) return;

    const span = this.spans.get(runId);
    if (!span) return;

    span.recordException(error);
    span.end();

    this.spans.delete(runId);
    this.startTimes.delete(runId);

    debug('Retriever error', { runId, error: error.message });
  }
}

/**
 * Create a new callback handler instance
 */
export function createCallbackHandler(): AgentBasisCallbackHandler {
  return new AgentBasisCallbackHandler();
}
