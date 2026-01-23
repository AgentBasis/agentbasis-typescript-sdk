import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'llms/openai': 'src/llms/openai.ts',
    'llms/anthropic': 'src/llms/anthropic.ts',
    'llms/google-genai': 'src/llms/google-genai.ts',
    'frameworks/langchain': 'src/frameworks/langchain.ts',
    'frameworks/vercel-ai': 'src/frameworks/vercel-ai.ts',
    'frameworks/mastra': 'src/frameworks/mastra.ts',
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
