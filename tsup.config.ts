import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'llms/openai': 'src/llms/openai/index.ts',
    'llms/anthropic': 'src/llms/anthropic/index.ts',
    'llms/gemini': 'src/llms/gemini/index.ts',
    'frameworks/langchain': 'src/frameworks/langchain/index.ts',
    'frameworks/vercel-ai-sdk': 'src/frameworks/vercel-ai-sdk/index.ts',
    'frameworks/mastra': 'src/frameworks/mastra/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: [
    'openai',
    '@anthropic-ai/sdk',
    '@google/generative-ai',
    '@langchain/core',
    'ai',
  ],
});
