import { hasApiKey, listProviders, refreshModels } from '@tracepact/core';
import type { ModelInfo } from '@tracepact/core';

interface ModelsOptions {
  refresh?: boolean;
  verbose?: boolean;
}

export async function models(providerId: string | undefined, opts: ModelsOptions): Promise<void> {
  if (opts.refresh) {
    try {
      await refreshModels();
      console.log('Models cache refreshed.\n');
    } catch {
      console.error('Failed to refresh from models.dev. Using cached data.\n');
    }
  }

  const providers = await listProviders();

  if (providerId) {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) {
      console.error(`Unknown provider: "${providerId}".`);
      console.log(`Available: ${providers.map((p) => p.id).join(', ')}`);
      process.exit(2);
    }
    printProvider(provider.id, provider.name, provider.models, provider.hasKey, opts.verbose);
    return;
  }

  for (const provider of providers) {
    printProvider(provider.id, provider.name, provider.models, provider.hasKey, opts.verbose);
  }

  console.log('  \u2713 = API key detected    --verbose for costs    --refresh to update cache');
}

function printProvider(
  id: string,
  name: string,
  providerModels: ModelInfo[],
  providerHasKey: boolean,
  verbose?: boolean
): void {
  console.log(`\n  ${name}${providerHasKey ? '' : ' (no key)'}`);

  for (const m of providerModels) {
    const check = hasApiKey(m.provider) ? '\u2713' : ' ';
    const ctx = formatCtx(m.contextWindow);
    const tags = m.tags.length > 0 ? `  ${m.tags.join(' ')}` : '';
    const cost = verbose ? `  $${m.cost.input}/$${m.cost.output} per 1M` : '';

    console.log(`  ${check} ${id}/${m.id.padEnd(38)} ${ctx}${cost}${tags}`);
  }
}

function formatCtx(tokens: number): string {
  if (tokens >= 1000000) return `${Math.round(tokens / 1000)}K ctx`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K ctx`;
  return `${tokens} ctx`;
}
