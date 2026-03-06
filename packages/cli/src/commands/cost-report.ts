import { existsSync, readFileSync } from 'node:fs';

export async function costReport(): Promise<void> {
  const tokenFile = '.tracepact/last-run-tokens.json';
  if (!existsSync(tokenFile)) {
    console.log('No token data found. Run `tracepact --live` first.');
    return;
  }

  const report = JSON.parse(readFileSync(tokenFile, 'utf-8'));

  console.log('\n  TracePact Token Report');
  console.log(`  ${'─'.repeat(50)}`);
  console.log(`  Input tokens:    ${report.totalInputTokens.toLocaleString()}`);
  console.log(`  Output tokens:   ${report.totalOutputTokens.toLocaleString()}`);
  console.log(
    `  Total tokens:    ${(report.totalInputTokens + report.totalOutputTokens).toLocaleString()}`
  );
  console.log(`  Live API calls:  ${report.totalApiCalls}`);
  console.log(`  Cache hits:      ${report.totalCacheHits}`);
  console.log();

  if (Object.keys(report.byProvider).length > 0) {
    console.log('  By Provider:');
    for (const [provider, usage] of Object.entries(report.byProvider)) {
      const u = usage as { inputTokens: number; outputTokens: number };
      console.log(
        `    ${provider}: ${(u.inputTokens + u.outputTokens).toLocaleString()} tokens (${u.inputTokens.toLocaleString()} in / ${u.outputTokens.toLocaleString()} out)`
      );
    }
    console.log();
  }

  if (report.byTest.length > 0) {
    console.log('  By Test:');
    for (const entry of report.byTest) {
      const tag = entry.cached ? ' (cached)' : '';
      const total = entry.inputTokens + entry.outputTokens;
      console.log(`    ${total.toLocaleString().padStart(8)} tok  ${entry.test}${tag}`);
    }
  }
}
