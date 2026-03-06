export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  maxOutput: number;
  supportsTools: boolean;
  supportsReasoning: boolean;
  cost: { input: number; output: number };
  tags: string[];
}

export interface ProviderInfo {
  id: string;
  name: string;
  envKeys: string[];
  api?: string;
  models: ModelInfo[];
}

export type ModelRole = 'agent' | 'judge' | 'embedding';

export interface EmbeddingModelInfo {
  id: string;
  name: string;
  provider: string;
  dimensions: number;
  maxInput: number;
  cost: number;
}
