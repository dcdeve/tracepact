import { createRequire } from 'node:module';
import { Command } from 'commander';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');
import { audit } from './commands/audit.js';
import { cache } from './commands/cache.js';
import { capture } from './commands/capture.js';
import { costReport } from './commands/cost-report.js';
import { doctor } from './commands/doctor.js';
import { init } from './commands/init.js';
import { models } from './commands/models.js';
import { runTests } from './commands/run.js';

export function createProgram(): Command {
  const program = new Command()
    .name('tracepact')
    .description('Test AI agents with deterministic, layered assertions')
    .version(version)
    .enablePositionalOptions();

  // Default command: run
  program
    .command('run [vitest-args...]', { isDefault: true })
    .description('Run tests via Vitest')
    .option('--live', 'Run live tests against real LLM APIs')
    .option('--full', 'Run all tests including expensive (Tier 3-4)')
    .option('--record', 'Record cassettes from live runs (implies --live)')
    .option('--replay <dir>', 'Replay from cassettes instead of calling APIs')
    .option('--no-cache', 'Skip cache for fresh API calls')
    .option('--health-check-strict', 'Exit if provider health check fails')
    .option('--budget <tokens>', 'Abort if total live tokens exceed threshold')
    .option('--json', 'Enable JSON reporter (.tracepact/results.json)')
    .option('--provider <name>', 'Select provider (e.g. openai, anthropic)')
    .allowUnknownOption()
    .passThroughOptions()
    .action((vitestArgs, opts) => runTests(opts, vitestArgs));

  program
    .command('init')
    .description('Initialize a new test suite')
    .option('--demo', 'Create self-contained demo suite')
    .option('--system-prompt', 'Bootstrap for raw system prompt agent')
    .option('--skill <path>', 'Generate from SKILL.md')
    .option('--pattern <name>', 'Use pattern template (api-client, data-transformer)')
    .option('--force', 'Overwrite existing files')
    .action((opts) => init(opts));

  program
    .command('audit <skill-path>')
    .description('Static analysis of SKILL.md (no API key needed)')
    .option('--format <type>', 'Output format: json or summary', 'summary')
    .option('--fail-on <severity>', 'Fail if severity threshold met (critical|high|medium|low)')
    .action((skillPath, opts) => audit(skillPath, opts));

  program
    .command('capture')
    .description('Generate test from a recorded cassette')
    .requiredOption('--skill <path>', 'Path to SKILL.md')
    .requiredOption('--prompt <text>', 'Test description/prompt')
    .option('--out <path>', 'Output test file')
    .option('--cassette <path>', 'Cassette path')
    .option('--provider <name>', 'Provider name')
    .option('--with-semantic', 'Enable semantic matching in generated test')
    .option('--dry-run', "Only generate from cassette, don't record")
    .action((opts) => capture(opts));

  const cacheCmd = program.command('cache').description('Manage the response cache');

  cacheCmd
    .command('list')
    .description('Show cached entries')
    .action(() => cache('list', {}));

  cacheCmd
    .command('clear')
    .description('Delete cache entries')
    .option('--stale', 'Only delete expired entries')
    .action((opts) => cache('clear', opts));

  cacheCmd
    .command('verify')
    .description('Check cache integrity')
    .action(() => cache('verify', {}));

  program
    .command('cost-report')
    .description('Show token usage from last run')
    .action(() => costReport());

  program
    .command('models [provider]')
    .description('List available models and providers')
    .option('--refresh', 'Force refresh from models.dev')
    .option('--verbose', 'Show pricing details')
    .action((providerId, opts) => models(providerId, opts));

  program
    .command('doctor')
    .description('Check environment and configuration')
    .action(() => doctor());

  return program;
}

const program = createProgram();
await program.parseAsync(process.argv);
