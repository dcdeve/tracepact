import { existsSync, writeFileSync } from 'node:fs';
import * as p from '@clack/prompts';
import {
  DEFAULT_EMBEDDING_MODEL,
  EMBEDDING_MODELS,
  hasApiKey,
  listProviders,
} from '@tracepact/core';
import type { EmbeddingModelInfo, ModelInfo, ProviderInfo } from '@tracepact/core';
import {
  API_CLIENT_TEST_TEMPLATE,
  DATA_TRANSFORMER_TEST_TEMPLATE,
  DEMO_CONFIG_TEMPLATE,
  DEMO_TEST_TEMPLATE,
  PACKAGE_JSON_TEMPLATE,
  SYSTEM_PROMPT_CONFIG_TEMPLATE,
  SYSTEM_PROMPT_TEST_TEMPLATE,
  TSCONFIG_TEMPLATE,
  VITEST_CONFIG_TEMPLATE,
} from '../patterns/templates.js';

interface InitOptions {
  demo?: boolean;
  skill?: string;
  systemPrompt?: boolean;
  pattern?: string;
  force?: boolean;
}

export async function init(opts: InitOptions): Promise<void> {
  // Non-interactive fast paths
  if (opts.demo) return initDemo(opts.force ?? false);
  if (opts.pattern) return initPattern(opts.pattern, opts.force ?? false);
  if (opts.systemPrompt) return initSystemPrompt(opts.force ?? false);
  if (opts.skill) return initFromSkill(opts.skill, opts.force ?? false);

  // Interactive wizard
  await initWizard(opts.force ?? false);
}

async function initWizard(force: boolean): Promise<void> {
  p.intro('TracePact Setup');

  // 1. Choose project type
  const projectType = await p.select({
    message: 'What kind of project are you setting up?',
    options: [
      { value: 'skill', label: 'SKILL.md agent', hint: 'agent defined by a SKILL.md file' },
      {
        value: 'system-prompt',
        label: 'System prompt agent',
        hint: 'agent with a raw system prompt',
      },
      {
        value: 'pattern',
        label: 'Pattern template',
        hint: 'pre-built template for common patterns',
      },
      { value: 'demo', label: 'Demo', hint: 'self-contained demo to explore TracePact' },
    ],
  });

  if (p.isCancel(projectType)) {
    p.cancel('Setup cancelled.');
    return;
  }

  if (projectType === 'demo') {
    initDemo(force);
    p.outro('Demo created. Run `npx tracepact` to try it.');
    return;
  }

  if (projectType === 'pattern') {
    const pattern = await p.select({
      message: 'Which pattern?',
      options: [
        {
          value: 'api-client',
          label: 'API Client',
          hint: 'HTTP calls, parse responses, write results',
        },
        {
          value: 'data-transformer',
          label: 'Data Transformer',
          hint: 'read files, transform data, write output',
        },
      ],
    });
    if (p.isCancel(pattern)) {
      p.cancel('Setup cancelled.');
      return;
    }
    initPattern(pattern, force);
    p.outro('Pattern created. Edit agent.tracepact.ts and run `npx tracepact`.');
    return;
  }

  // 2. SKILL.md path (for skill type)
  let skillPath: string | undefined;
  if (projectType === 'skill') {
    if (existsSync('SKILL.md')) {
      const useExisting = await p.confirm({
        message: 'Found SKILL.md in current directory. Use it?',
        initialValue: true,
      });
      if (p.isCancel(useExisting)) {
        p.cancel('Setup cancelled.');
        return;
      }
      skillPath = useExisting ? 'SKILL.md' : undefined;
    }

    if (!skillPath) {
      const inputPath = await p.text({
        message: 'Path to SKILL.md:',
        placeholder: './SKILL.md',
        validate: (val) => {
          if (!val) return 'Path is required';
          if (!existsSync(val)) return `File not found: ${val}`;
          return undefined;
        },
      });
      if (p.isCancel(inputPath)) {
        p.cancel('Setup cancelled.');
        return;
      }
      skillPath = inputPath;
    }
  }

  // 3. Provider selection
  const providerSpinner = p.spinner();
  providerSpinner.start('Loading model catalog...');

  let providers: Array<ProviderInfo & { hasKey: boolean }>;
  try {
    providers = await listProviders();
  } catch {
    providerSpinner.stop('Could not load models (using defaults)');
    // Fall back to simple config generation
    generateConfigFiles(skillPath, undefined, undefined, undefined, force);
    p.outro('Config created. Run `npx tracepact` to get started.');
    return;
  }
  providerSpinner.stop(`Found ${providers.length} providers`);

  // Show which providers have keys
  const availableProviders = providers.filter((p) => p.hasKey);
  if (availableProviders.length > 0) {
    p.note(
      availableProviders.map((p) => `  ${p.name} (${p.models.length} models)`).join('\n'),
      'API keys detected'
    );
  } else {
    p.note(
      'No API keys found. Set environment variables to enable live testing.\nExample: ANTHROPIC_API_KEY, OPENAI_API_KEY',
      'No API keys detected'
    );
  }

  const providerOptions = providers.map((prov) => ({
    value: prov.id,
    label: `${prov.name}${prov.hasKey ? ' \u2713' : ''}`,
    hint: `${prov.models.length} models${prov.hasKey ? '' : ' (no key)'}`,
  }));

  const selectedProvider = await p.select({
    message: 'Select a provider for live tests:',
    options: providerOptions,
  });

  if (p.isCancel(selectedProvider)) {
    p.cancel('Setup cancelled.');
    return;
  }

  const provider = providers.find((prov) => prov.id === selectedProvider);
  if (!provider) return;

  // 4. Agent model selection
  const agentModel = await selectModel(provider.models, 'Select the agent model (for live tests):');
  if (!agentModel) return;

  // 5. Judge model selection (suggest cheapest)
  const cheapModels = [...provider.models].sort(
    (a, b) => a.cost.input + a.cost.output - (b.cost.input + b.cost.output)
  );
  const defaultJudge = cheapModels[0];

  const wantJudge = await p.confirm({
    message: `Use ${defaultJudge?.name ?? 'cheapest model'} as judge model?`,
    initialValue: true,
  });
  if (p.isCancel(wantJudge)) {
    p.cancel('Setup cancelled.');
    return;
  }

  let judgeModel: ModelInfo | undefined;
  if (wantJudge && defaultJudge) {
    judgeModel = defaultJudge;
  } else {
    judgeModel = await selectModel(provider.models, 'Select the judge model (cheap is better):');
    if (!judgeModel) return;
  }

  // 6. Embedding model selection
  const embeddingOptions = EMBEDDING_MODELS.filter((em) => hasApiKey(em.provider));
  let embeddingModel: EmbeddingModelInfo | undefined;

  if (embeddingOptions.length > 0) {
    const defaultEmbed = EMBEDDING_MODELS.find(
      (em) => `${em.provider}/${em.id}` === DEFAULT_EMBEDDING_MODEL
    );
    const useDefaultEmbed = defaultEmbed && hasApiKey(defaultEmbed.provider);

    if (useDefaultEmbed) {
      const confirm = await p.confirm({
        message: `Use ${defaultEmbed.name} for semantic assertions?`,
        initialValue: true,
      });
      if (p.isCancel(confirm)) {
        p.cancel('Setup cancelled.');
        return;
      }
      embeddingModel = confirm ? defaultEmbed : undefined;
    }

    if (!embeddingModel && embeddingOptions.length > 0) {
      const selected = await p.select({
        message: 'Select embedding model:',
        options: [
          ...embeddingOptions.map((em) => ({
            value: em.id,
            label: em.name,
            hint: `${em.dimensions}d, $${em.cost}/1M tokens`,
          })),
          { value: 'skip', label: 'Skip', hint: 'no semantic assertions' },
        ],
      });
      if (p.isCancel(selected)) {
        p.cancel('Setup cancelled.');
        return;
      }
      if (selected !== 'skip') {
        embeddingModel = embeddingOptions.find((em) => em.id === selected);
      }
    }
  }

  // 7. Generate files
  const agentQualified = `${selectedProvider}/${agentModel.id}`;
  const judgeQualified = judgeModel ? `${selectedProvider}/${judgeModel.id}` : undefined;
  const embeddingQualified = embeddingModel
    ? `${embeddingModel.provider}/${embeddingModel.id}`
    : undefined;

  generateConfigFiles(skillPath, agentQualified, judgeQualified, embeddingQualified, force);

  // Summary
  const summary = [`  Provider: ${provider.name}`, `  Agent:    ${agentQualified}`];
  if (judgeQualified) summary.push(`  Judge:    ${judgeQualified}`);
  if (embeddingQualified) summary.push(`  Embed:    ${embeddingQualified}`);
  p.note(summary.join('\n'), 'Configuration');

  p.outro('Setup complete. Run `npx tracepact` to start testing.');
}

async function selectModel(models: ModelInfo[], message: string): Promise<ModelInfo | undefined> {
  const selected = await p.select({
    message,
    options: models.map((m) => ({
      value: m.id,
      label: m.name,
      hint: `$${m.cost.input}/$${m.cost.output} per 1M, ${formatCtx(m.contextWindow)}${m.tags.length > 0 ? ` [${m.tags.join(', ')}]` : ''}`,
    })),
  });
  if (p.isCancel(selected)) {
    p.cancel('Setup cancelled.');
    return undefined;
  }
  return models.find((m) => m.id === selected);
}

function formatCtx(tokens: number): string {
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K ctx`;
  return `${tokens} ctx`;
}

function generateConfigFiles(
  skillPath: string | undefined,
  agentModel: string | undefined,
  judgeModel: string | undefined,
  embeddingModel: string | undefined,
  force: boolean
): void {
  const configContent = buildConfigContent(skillPath, agentModel, judgeModel, embeddingModel);

  const files: Record<string, string> = {
    'tracepact.config.ts': configContent,
    'tracepact.vitest.ts': VITEST_CONFIG_TEMPLATE,
    'agent.tracepact.ts': SYSTEM_PROMPT_TEST_TEMPLATE,
  };

  writeFiles(files, force);
}

function buildConfigContent(
  skillPath: string | undefined,
  agentModel: string | undefined,
  judgeModel: string | undefined,
  embeddingModel: string | undefined
): string {
  const lines: string[] = [];
  lines.push("import { defineConfig } from '@tracepact/core';");
  lines.push('');
  lines.push('export default defineConfig({');

  if (skillPath) {
    lines.push(`  skill: '${skillPath}',`);
  }

  if (agentModel) {
    lines.push(`  model: '${agentModel}',`);
  }

  if (judgeModel || embeddingModel) {
    lines.push('  roles: {');
    if (judgeModel) lines.push(`    judge: '${judgeModel}',`);
    if (embeddingModel) lines.push(`    embedding: '${embeddingModel}',`);
    lines.push('  },');
  }

  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

// --- Non-interactive helpers (kept for --demo, --pattern, etc.) ---

function initDemo(force: boolean): void {
  const files: Record<string, string> = {
    'tracepact.config.ts': DEMO_CONFIG_TEMPLATE,
    'tracepact.vitest.ts': VITEST_CONFIG_TEMPLATE,
    'demo.tracepact.ts': DEMO_TEST_TEMPLATE,
  };

  if (!existsSync('package.json')) {
    files['package.json'] = PACKAGE_JSON_TEMPLATE;
  }
  if (!existsSync('tsconfig.json')) {
    files['tsconfig.json'] = TSCONFIG_TEMPLATE;
  }

  writeFiles(files, force);
  console.log(`Created demo suite.

Next steps:
  npm install            Install dependencies
  npx vitest run --config tracepact.vitest.ts   Run tests (all should pass)
  Edit demo.tracepact.ts Adapt to your agent`);
}

function initSystemPrompt(force: boolean): void {
  const files: Record<string, string> = {
    'tracepact.config.ts': SYSTEM_PROMPT_CONFIG_TEMPLATE,
    'tracepact.vitest.ts': VITEST_CONFIG_TEMPLATE,
    'agent.tracepact.ts': SYSTEM_PROMPT_TEST_TEMPLATE,
  };
  writeFiles(files, force);
  console.log(`Created starter test for system-prompt agent.

Next steps:
  Edit agent.tracepact.ts  Set your system prompt and mock tools
  npx tracepact            Run tests`);
}

const PATTERN_TEMPLATES: Record<string, { test: string; description: string }> = {
  'api-client': {
    test: API_CLIENT_TEST_TEMPLATE,
    description: 'API client agent',
  },
  'data-transformer': {
    test: DATA_TRANSFORMER_TEST_TEMPLATE,
    description: 'data transformer agent',
  },
};

function initPattern(pattern: string, force: boolean): void {
  const entry = PATTERN_TEMPLATES[pattern];
  if (!entry) {
    const available = Object.keys(PATTERN_TEMPLATES).join(', ');
    console.error(`Unknown pattern "${pattern}". Available: ${available}`);
    process.exitCode = 2;
    return;
  }

  const files: Record<string, string> = {
    'tracepact.config.ts': SYSTEM_PROMPT_CONFIG_TEMPLATE,
    'tracepact.vitest.ts': VITEST_CONFIG_TEMPLATE,
    'agent.tracepact.ts': entry.test,
  };
  writeFiles(files, force);
  console.log(`Created test files for ${entry.description}.

Next steps:
  Edit agent.tracepact.ts  Customize mock tools for your agent
  npx tracepact            Run tests`);
}

function initFromSkill(skillPath: string, force: boolean): void {
  const files: Record<string, string> = {
    'tracepact.config.ts': `import { defineConfig } from '@tracepact/core';\n\nexport default defineConfig({\n  skill: '${skillPath}',\n});\n`,
    'tracepact.vitest.ts': VITEST_CONFIG_TEMPLATE,
    'agent.tracepact.ts': SYSTEM_PROMPT_TEST_TEMPLATE,
  };
  writeFiles(files, force);
  console.log(`Created test files for skill at ${skillPath}.

Next steps:
  Edit agent.tracepact.ts  Customize mock tools for your skill
  npx tracepact            Run tests`);
}

function writeFiles(files: Record<string, string>, force: boolean): void {
  for (const [name, content] of Object.entries(files)) {
    if (existsSync(name) && !force) {
      console.log(`  Skipping ${name} (already exists, use --force to overwrite)`);
      continue;
    }
    writeFileSync(name, content);
    console.log(`  Created ${name}`);
  }
}
