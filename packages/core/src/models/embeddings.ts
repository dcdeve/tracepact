import type { EmbeddingModelInfo } from './types.js';

/**
 * Static list of embedding models. models.dev doesn't cover these well,
 * so we maintain a small curated list.
 */
export const EMBEDDING_MODELS: EmbeddingModelInfo[] = [
  {
    id: 'text-embedding-3-small',
    name: 'OpenAI Embedding 3 Small',
    provider: 'openai',
    dimensions: 1536,
    maxInput: 8191,
    cost: 0.02,
  },
  {
    id: 'text-embedding-3-large',
    name: 'OpenAI Embedding 3 Large',
    provider: 'openai',
    dimensions: 3072,
    maxInput: 8191,
    cost: 0.13,
  },
  {
    id: 'voyage-3',
    name: 'Voyage 3',
    provider: 'anthropic',
    dimensions: 1024,
    maxInput: 32000,
    cost: 0.06,
  },
];

export const DEFAULT_EMBEDDING_MODEL = 'openai/text-embedding-3-small';
