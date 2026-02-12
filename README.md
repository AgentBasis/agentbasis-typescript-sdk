# AgentBasis TypeScript SDK

Observability and tracing for AI agents built with TypeScript.

## Install

```bash
npm install agentbasis
```

Optional integrations (install only what you use):

```bash
npm install openai @anthropic-ai/sdk @google/generative-ai @langchain/core ai
```

## Quick Start

```ts
import { AgentBasis } from 'agentbasis';

AgentBasis.init({
  apiKey: process.env.AGENTBASIS_API_KEY,
  agentId: process.env.AGENTBASIS_AGENT_ID,
  includeContent: false,
  debug: false,
});
```

Or configure via environment variables:

- `AGENTBASIS_API_KEY`
- `AGENTBASIS_AGENT_ID`
- `AGENTBASIS_DEBUG` (`true`/`false`)
- `AGENTBASIS_INCLUDE_CONTENT` (`true`/`false`)

## Core APIs

### Context tracing

```ts
import { withContext } from 'agentbasis';

await withContext({ userId: 'u_123', sessionId: 's_abc' }, async () => {
  // Any traced work inside this function is tagged with context attributes.
});
```

### Function tracing

```ts
import { trace } from 'agentbasis';

const summarize = trace('summarize', async (input: string) => {
  return `summary: ${input}`;
});
```

### Lifecycle control

```ts
await AgentBasis.flush();
await AgentBasis.shutdown();
```

## LLM SDK Instrumentation

### OpenAI

```ts
import { instrument as instrumentOpenAI } from 'agentbasis/llms/openai';

instrumentOpenAI();
```

### Anthropic

```ts
import { instrument as instrumentAnthropic } from 'agentbasis/llms/anthropic';

instrumentAnthropic();
```

### Gemini

```ts
import { instrument as instrumentGemini } from 'agentbasis/llms/gemini';

instrumentGemini();
```

Call `AgentBasis.init()` before any instrumentation.

## Framework Integrations

### LangChain

```ts
import { AgentBasisCallbackHandler } from 'agentbasis/frameworks/langchain';

const handler = new AgentBasisCallbackHandler();
// Pass handler in LangChain callbacks
```

### Vercel AI SDK

```ts
import {
  wrapLanguageModel,
  trackAICall,
  trackStreamingCall,
} from 'agentbasis/frameworks/vercel-ai';
```

### Mastra

```ts
import {
  withAgentTracing,
  trackAgentExecution,
  trackToolExecution,
} from 'agentbasis/frameworks/mastra';
```

## Development

```bash
npm run typecheck
npm run build
npm run test -- --run
```

## Notes

- Node.js `>=18` is required.
- Content capture is disabled by default (`includeContent: false`).
- This SDK exports both ESM and CJS entrypoints.