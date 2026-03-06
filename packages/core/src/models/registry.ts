import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { PROVIDER_ENV_KEYS } from '../driver/presets.js';
import { log } from '../logger.js';
import { SNAPSHOT_PROVIDERS } from './snapshot.js';
import type { ModelInfo, ProviderInfo } from './types.js';

const CACHE_DIR = join(homedir(), '.tracepact');
const CACHE_FILE = join(CACHE_DIR, 'models-cache.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MODELS_DEV_URL = 'https://models.dev/api.json';
const FETCH_TIMEOUT_MS = 10_000;

/** Providers we support via our driver system (OpenAI-compatible + Anthropic). */
const SUPPORTED_PROVIDERS = new Set([
  'openai',
  'anthropic',
  'groq',
  'deepseek',
  'together',
  'mistral',
  'openrouter',
  'xai',
  'cerebras',
  'fireworks',
  'perplexity',
]);

interface CacheEntry {
  fetchedAt: number;
  providers: ProviderInfo[];
}

let _cached: ProviderInfo[] | null = null;

function readCache(): CacheEntry | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const raw = readFileSync(CACHE_FILE, 'utf-8');
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

function writeCache(providers: ProviderInfo[]): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    const entry: CacheEntry = { fetchedAt: Date.now(), providers };
    writeFileSync(CACHE_FILE, JSON.stringify(entry), 'utf-8');
  } catch {
    log.warn('Failed to write models cache');
  }
}

function transformModelsDevResponse(data: Record<string, any>): ProviderInfo[] {
  const providers: ProviderInfo[] = [];

  for (const [providerId, providerData] of Object.entries(data)) {
    if (!SUPPORTED_PROVIDERS.has(providerId)) continue;
    if (!providerData.models || typeof providerData.models !== 'object') continue;

    const models: ModelInfo[] = [];
    for (const [modelId, m] of Object.entries(providerData.models) as [string, any][]) {
      // Only include models that support tool calling and text output
      if (!m.tool_call) continue;
      if (m.status === 'deprecated') continue;
      if (m.modalities?.output && !m.modalities.output.includes('text')) continue;

      const tags: string[] = [];
      if (m.reasoning) tags.push('reasoning');
      if (m.cost && m.cost.input < 1 && m.cost.output < 2) tags.push('cheap');

      models.push({
        id: modelId,
        name: m.name || modelId,
        provider: providerId,
        contextWindow: m.limit?.context ?? 0,
        maxOutput: m.limit?.output ?? 0,
        supportsTools: true,
        supportsReasoning: m.reasoning ?? false,
        cost: {
          input: m.cost?.input ?? 0,
          output: m.cost?.output ?? 0,
        },
        tags,
      });
    }

    if (models.length === 0) continue;

    // Sort by cost (cheapest first)
    models.sort((a, b) => a.cost.input + a.cost.output - (b.cost.input + b.cost.output));

    providers.push({
      id: providerId,
      name: providerData.name || providerId,
      envKeys: providerData.env ?? [],
      api: providerData.api,
      models,
    });
  }

  // Sort providers by name
  providers.sort((a, b) => a.name.localeCompare(b.name));

  return providers;
}

/**
 * Fetch from models.dev and update cache.
 */
export async function refreshModels(): Promise<ProviderInfo[]> {
  try {
    const response = await fetch(MODELS_DEV_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'TracePact' },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const providers = transformModelsDevResponse(data as Record<string, any>);
    writeCache(providers);
    _cached = providers;
    log.info(`Models cache refreshed: ${providers.reduce((s, p) => s + p.models.length, 0)} models from ${providers.length} providers`);
    return providers;
  } catch (err: any) {
    log.warn(`Failed to fetch models.dev: ${err.message}`);
    throw err;
  }
}

/**
 * Load providers: cache → fetch → snapshot fallback.
 */
export async function loadProviders(): Promise<ProviderInfo[]> {
  if (_cached) return _cached;

  // 1. Try local cache
  const cache = readCache();
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    _cached = cache.providers;
    return _cached;
  }

  // 2. Try fetching fresh data
  try {
    return await refreshModels();
  } catch {
    // 3. Use stale cache if available
    if (cache) {
      log.info('Using stale models cache');
      _cached = cache.providers;
      return _cached;
    }

    // 4. Fall back to static snapshot
    log.info('Using built-in model snapshot');
    _cached = SNAPSHOT_PROVIDERS;
    return _cached;
  }
}

/**
 * List providers with auth status.
 */
export async function listProviders(): Promise<Array<ProviderInfo & { hasKey: boolean }>> {
  const providers = await loadProviders();
  return providers.map((p) => ({
    ...p,
    hasKey: hasApiKey(p.id),
  }));
}

/**
 * List models, optionally filtered by provider.
 */
export async function listModels(providerId?: string): Promise<ModelInfo[]> {
  const providers = await loadProviders();
  if (providerId) {
    const provider = providers.find((p) => p.id === providerId);
    return provider?.models ?? [];
  }
  return providers.flatMap((p) => p.models);
}

/**
 * Get a specific model by provider/model ID (e.g. "anthropic/claude-sonnet-4-5").
 */
export async function getModel(qualifiedId: string): Promise<ModelInfo | undefined> {
  const [providerId, modelId] = qualifiedId.split('/');
  if (!providerId || !modelId) return undefined;
  const models = await listModels(providerId);
  return models.find((m) => m.id === modelId);
}

/**
 * Get the recommended model for a specific role.
 */
export async function getRecommended(
  role: 'agent' | 'judge',
  preferredProvider?: string
): Promise<string | undefined> {
  const providers = await loadProviders();

  // Prefer the specified provider, fall back to any with a key
  const candidates = preferredProvider
    ? providers.filter((p) => p.id === preferredProvider)
    : providers.filter((p) => hasApiKey(p.id));

  if (candidates.length === 0) return undefined;

  for (const provider of candidates) {
    if (role === 'agent') {
      // Pick the most capable model (highest cost = most capable, typically)
      const best = [...provider.models].sort(
        (a, b) => b.cost.input + b.cost.output - (a.cost.input + a.cost.output)
      )[0];
      if (best) return `${provider.id}/${best.id}`;
    }

    if (role === 'judge') {
      // Pick the cheapest model that supports tools
      const cheapest = provider.models[0]; // already sorted by cost
      if (cheapest) return `${provider.id}/${cheapest.id}`;
    }
  }

  return undefined;
}

/**
 * Check if an API key is available for a provider.
 */
export function hasApiKey(providerId: string): boolean {
  const envKey = PROVIDER_ENV_KEYS[providerId];
  return envKey ? Boolean(process.env[envKey]) : false;
}

/**
 * List providers that have API keys configured.
 */
export function detectAvailableProviders(): string[] {
  return Object.entries(PROVIDER_ENV_KEYS)
    .filter(([, envKey]) => process.env[envKey])
    .map(([name]) => name);
}

/** Reset in-memory cache (for testing). */
export function resetCache(): void {
  _cached = null;
}
