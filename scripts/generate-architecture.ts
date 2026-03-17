#!/usr/bin/env -S npx tsx

/**
 * generate-architecture.ts
 *
 * Generates factual architecture docs from code analysis and merges them
 * into architecture/*.md files using <!-- BEGIN:GENERATED --> / <!-- END:GENERATED -->
 * markers. LLM-maintained content outside the markers is never touched.
 *
 * Usage: npx tsx scripts/generate-architecture.ts [--root ./] [--out architecture]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  type ClassDeclaration,
  type EnumDeclaration,
  type FunctionDeclaration,
  type InterfaceDeclaration,
  Node,
  Project,
  type TypeAliasDeclaration,
} from 'ts-morph';

// ─── Config ────────────────────────────────────────────────────────────────

interface Config {
  root: string;
  outDir: string;
  srcGlobs: string[];
  ignore: string[];
  entrypointPatterns: RegExp[];
  envVarPattern: RegExp;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  let root = '.';
  let outDir = 'architecture';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root' && args[i + 1]) root = args[++i] as string;
    if (args[i] === '--out' && args[i + 1]) outDir = args[++i] as string;
  }

  return {
    root: path.resolve(root),
    outDir: path.resolve(root, outDir),
    srcGlobs: ['packages/*/src/**/*.ts'],
    ignore: [
      '**/node_modules/**',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/dist/**',
      '**/build/**',
      '**/__tests__/**',
      '**/*.d.ts',
    ],
    entrypointPatterns: [
      /process\.argv/,
      /\.listen\(/,
      /createServer/,
      /\.parse\(\s*process/,
      /\byargs\b|\bcommander\b|\bmeow\b|\bcac\b/,
      /export\s+(async\s+)?function\s+main/,
    ],
    envVarPattern: /process\.env\.([A-Z_][A-Z0-9_]*)/g,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const BEGIN_MARKER = '<!-- BEGIN:GENERATED -->';
const END_MARKER = '<!-- END:GENERATED -->';

/**
 * Writes `content` into the <!-- BEGIN:GENERATED --> / <!-- END:GENERATED --> block
 * of `filePath`. Three cases:
 *   - File doesn't exist → creates it with `# title` + the block.
 *   - File has markers   → replaces only the content between them.
 *   - File has no markers → appends the block at the end with a --- separator.
 */
function upsertGeneratedBlock(
  filePath: string,
  content: string,
  title: string
): 'created' | 'updated' | 'appended' {
  const note = '_Auto-generated from code — do not edit this block manually._\n\n';
  const block = `${BEGIN_MARKER}\n${note}${content.trim()}\n${END_MARKER}`;

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `# ${title}\n\n${block}\n`);
    return 'created';
  }

  const existing = fs.readFileSync(filePath, 'utf-8');
  const beginIdx = existing.indexOf(BEGIN_MARKER);
  const endIdx = existing.indexOf(END_MARKER);

  if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
    const before = existing.substring(0, beginIdx);
    const after = existing.substring(endIdx + END_MARKER.length);
    fs.writeFileSync(filePath, before + block + after);
    return 'updated';
  }

  // No markers found — append with a separator
  fs.writeFileSync(filePath, `${existing.trimEnd()}\n\n---\n\n${block}\n`);
  return 'appended';
}

function relative(config: Config, absPath: string): string {
  return path.relative(config.root, absPath);
}

function countLines(filePath: string): number {
  try {
    return fs.readFileSync(filePath, 'utf-8').split('\n').length;
  } catch {
    return 0;
  }
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (
      entry.name.startsWith('.') ||
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === 'build'
    )
      continue;
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function dirTree(dir: string, depth = 2, prefix = ''): string {
  if (depth < 0 || !fs.existsSync(dir)) return '';
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(
      (e) =>
        !e.name.startsWith('.') &&
        e.name !== 'node_modules' &&
        e.name !== 'dist' &&
        e.name !== 'build'
    )
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  let result = '';
  entries.forEach((entry, i) => {
    const isLast = i === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';
    result += `${prefix}${connector}${entry.name}\n`;
    if (entry.isDirectory()) {
      result += dirTree(path.join(dir, entry.name), depth - 1, prefix + childPrefix);
    }
  });
  return result;
}

// ─── Project loader ────────────────────────────────────────────────────────

/**
 * For a monorepo where each package has its own tsconfig.json extending
 * tsconfig.base.json, we create one ts-morph Project per package tsconfig
 * and merge all source files into a single collection for analysis.
 *
 * ts-morph needs real tsconfig files to resolve paths correctly; pointing at
 * tsconfig.base.json directly wouldn't work because it has no `include`.
 */
function loadProject(config: Config): Project {
  // ts-morph compiler options that override whatever the package tsconfigs say,
  // so analysis works regardless of verbatimModuleSyntax / moduleResolution settings.
  const compilerOptionsOverride = {
    skipLibCheck: true,
    noEmit: true,
    // Use Node16 resolution so ts-morph can find modules without bundler magic
    moduleResolution: 2 /* NodeJs */ as const,
  };

  const project = new Project({
    compilerOptions: compilerOptionsOverride,
    skipAddingFilesFromTsConfig: true,
  });

  // Find all package-level tsconfigs
  const pkgTsConfigs = fs
    .readdirSync(path.join(config.root, 'packages'), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(config.root, 'packages', e.name, 'tsconfig.json'))
    .filter(fs.existsSync);

  if (pkgTsConfigs.length === 0) {
    // Fallback: glob for source files directly
    for (const glob of config.srcGlobs) {
      project.addSourceFilesAtPaths(path.join(config.root, glob));
    }
  } else {
    for (const tsconfig of pkgTsConfigs) {
      project.addSourceFilesFromTsConfig(tsconfig);
    }
  }

  // Remove ignored files
  const ignoreRegexes = config.ignore.map(
    (p) => new RegExp(p.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\./g, '\\.'))
  );

  for (const sourceFile of project.getSourceFiles()) {
    const relPath = relative(config, sourceFile.getFilePath());
    if (ignoreRegexes.some((r) => r.test(relPath))) {
      project.removeSourceFile(sourceFile);
    }
  }

  return project;
}

// ─── Generators ────────────────────────────────────────────────────────────

function generateShape(config: Config): string {
  let md = '> Auto-generated directory structure (depth 2)\n\n';
  md += '```\n';
  md += dirTree(config.root, 2);
  md += '```\n\n';

  md += '## Directory Roles\n\n';
  md += '| Path | Type | Files | Lines |\n';
  md += '|------|------|-------|-------|\n';

  const topDirs = fs
    .readdirSync(config.root, { withFileTypes: true })
    .filter(
      (e) =>
        e.isDirectory() &&
        !e.name.startsWith('.') &&
        !['node_modules', 'dist', 'build', 'coverage', '.git'].includes(e.name)
    )
    .map((e) => e.name)
    .sort();

  for (const dir of topDirs) {
    const fullDir = path.join(config.root, dir);
    const files = walkDir(fullDir);
    const codeFiles = files.filter((f) =>
      ['.ts', '.tsx', '.js', '.jsx'].some((ext) => f.endsWith(ext))
    );
    const totalLines = codeFiles.reduce((sum, f) => sum + countLines(f), 0);
    const type = categorizeDir(dir);
    md += `| \`${dir}/\` | ${type} | ${files.length} | ${totalLines} |\n`;
  }

  // Package internals — src subdirectories per package
  const packagesDir = path.join(config.root, 'packages');
  if (fs.existsSync(packagesDir)) {
    md += '\n## Package internals\n\n';
    md += '> Subdirectories of `packages/*/src/` (depth 1)\n\n';
    md += '| Package | Module | Files | Lines |\n';
    md += '|---------|--------|-------|-------|\n';

    const pkgNames = fs
      .readdirSync(packagesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    for (const pkgName of pkgNames) {
      const srcDir = path.join(packagesDir, pkgName, 'src');
      if (!fs.existsSync(srcDir)) continue;

      const entries = fs.readdirSync(srcDir, { withFileTypes: true }).sort((a, b) => {
        // directories first, then files
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      for (const entry of entries) {
        const fullPath = path.join(srcDir, entry.name);
        if (entry.isDirectory()) {
          const files = walkDir(fullPath);
          const codeFiles = files.filter((f) =>
            ['.ts', '.tsx', '.js', '.jsx'].some((ext) => f.endsWith(ext))
          );
          const lines = codeFiles.reduce((sum, f) => sum + countLines(f), 0);
          md += `| \`packages/${pkgName}\` | \`src/${entry.name}/\` | ${codeFiles.length} | ${lines} |\n`;
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          const lines = countLines(fullPath);
          md += `| \`packages/${pkgName}\` | \`src/${entry.name}\` | 1 | ${lines} |\n`;
        }
      }
    }
  }

  return md;
}

function categorizeDir(name: string): string {
  const map: Record<string, string> = {
    src: 'source',
    lib: 'library',
    packages: 'packages',
    apps: 'apps',
    test: 'tests',
    tests: 'tests',
    __tests__: 'tests',
    spec: 'tests',
    scripts: 'scripts',
    bin: 'binaries',
    cmd: 'commands',
    config: 'config',
    configs: 'config',
    docs: 'docs',
    types: 'types',
    utils: 'utility',
    helpers: 'utility',
    shared: 'shared',
    internal: 'internal',
    pkg: 'packages',
    modules: 'modules',
    plugins: 'plugins',
    adapters: 'adapters',
    services: 'services',
  };
  return map[name] ?? 'directory';
}

function generateEntrypoints(config: Config, project: Project): string {
  let md = '> Auto-detected entry points based on code patterns and package.json files\n\n';

  // Root package.json scripts
  const rootPkgPath = path.join(config.root, 'package.json');
  if (fs.existsSync(rootPkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
    if (pkg.scripts) {
      md += '## Root package.json — scripts\n\n';
      md += '| Script | Command |\n|--------|---------|\n';
      for (const [name, cmd] of Object.entries(pkg.scripts as Record<string, string>)) {
        md += `| \`${name}\` | \`${cmd}\` |\n`;
      }
      md += '\n';
    }
  }

  // Per-package package.json
  const packagesDir = path.join(config.root, 'packages');
  if (fs.existsSync(packagesDir)) {
    md += '## Per-package exports & bin\n\n';
    const pkgDirs = fs
      .readdirSync(packagesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    for (const pkgName of pkgDirs) {
      const pkgJsonPath = path.join(packagesDir, pkgName, 'package.json');
      if (!fs.existsSync(pkgJsonPath)) continue;
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));

      md += `### \`packages/${pkgName}\`\n\n`;

      if (pkg.main) md += `- **main:** \`${pkg.main}\`\n`;
      if (pkg.types) md += `- **types:** \`${pkg.types}\`\n`;

      if (pkg.exports) {
        md += `\n**exports:**\n\`\`\`json\n${JSON.stringify(pkg.exports, null, 2)}\n\`\`\`\n`;
      }

      if (pkg.bin) {
        const bins = typeof pkg.bin === 'string' ? { [pkg.name]: pkg.bin } : pkg.bin;
        md += '\n**bin:**\n';
        for (const [cmd, p] of Object.entries(bins as Record<string, string>)) {
          md += `- \`${cmd}\` → \`${p}\`\n`;
        }
      }

      md += '\n';
    }
  }

  // Detected in code
  md += '## Detected in code\n\n';
  md += '| File | Pattern | Line |\n|------|---------|------|\n';

  for (const sourceFile of project.getSourceFiles()) {
    const text = sourceFile.getFullText();
    for (const pattern of config.entrypointPatterns) {
      const localPattern = new RegExp(pattern.source, pattern.flags);
      const match = localPattern.exec(text);
      if (match) {
        const line = text.substring(0, match.index).split('\n').length;
        md += `| \`${relative(config, sourceFile.getFilePath())}\` | \`${match[0].substring(0, 50)}\` | ${line} |\n`;
        break;
      }
    }
  }

  return md;
}

function generateDependencies(config: Config): string {
  let md = '> Auto-extracted from package.json files across the monorepo\n\n';

  // Root
  const rootPkgPath = path.join(config.root, 'package.json');
  if (fs.existsSync(rootPkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
    md += renderDeps('Root devDependencies', pkg.devDependencies);
  }

  // Packages
  const packagesDir = path.join(config.root, 'packages');
  if (!fs.existsSync(packagesDir)) return md;

  const pkgDirs = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  for (const pkgName of pkgDirs) {
    const pkgJsonPath = path.join(packagesDir, pkgName, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) continue;
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));

    md += `## \`packages/${pkgName}\`\n\n`;
    md += renderDeps('Production', pkg.dependencies);
    md += renderDeps('Dev', pkg.devDependencies);
    md += renderDeps('Peer', pkg.peerDependencies);
  }

  return md;
}

function renderDeps(label: string, deps: Record<string, string> | undefined): string {
  if (!deps || Object.keys(deps).length === 0) return '';
  let out = `### ${label}\n\n`;
  out += '| Package | Version |\n|---------|---------|\n';
  for (const [name, ver] of Object.entries(deps)) {
    out += `| \`${name}\` | \`${ver}\` |\n`;
  }
  return `${out}\n`;
}

function inferTypeCategory(kind: 'interface' | 'type' | 'enum'): string {
  if (kind === 'enum') return 'enum';
  if (kind === 'type') return 'type alias';
  return 'interface';
}

function generateInterfaces(config: Config, project: Project): string {
  let md = '> Índice de tipos exportados — para ver la firma completa, leer el archivo fuente.\n\n';

  const rows: { name: string; kind: string; file: string }[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const relPath = relative(config, sourceFile.getFilePath());

    for (const iface of sourceFile.getInterfaces()) {
      if (!iface.isExported()) continue;
      rows.push({ name: iface.getName(), kind: inferTypeCategory('interface'), file: relPath });
    }

    for (const typeAlias of sourceFile.getTypeAliases()) {
      if (!typeAlias.isExported()) continue;
      rows.push({ name: typeAlias.getName(), kind: inferTypeCategory('type'), file: relPath });
    }

    for (const enumDecl of sourceFile.getEnums()) {
      if (!enumDecl.isExported()) continue;
      rows.push({ name: enumDecl.getName(), kind: inferTypeCategory('enum'), file: relPath });
    }
  }

  rows.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name));

  md += '| Tipo | Categoría | Archivo |\n';
  md += '|------|-----------|--------|\n';

  for (const row of rows) {
    md += `| \`${row.name}\` | ${row.kind} | \`${row.file}\` |\n`;
  }

  if (rows.length === 0) md += '_No exported interfaces or types found._\n';

  return md;
}

function formatInterface(iface: InterfaceDeclaration): string {
  const text = iface.getText();
  if (text.split('\n').length > 20) {
    const members = iface
      .getMembers()
      .map((m) => `  ${m.getText().split('\n')[0]};`)
      .join('\n');
    return `// simplified\nexport interface ${iface.getName()} {\n${members}\n}`;
  }
  return text;
}

function formatTypeAlias(t: TypeAliasDeclaration): string {
  const text = t.getText();
  if (text.split('\n').length > 10) {
    return `// simplified\nexport type ${t.getName()} = /* ${t.getType().getText().substring(0, 80)}... */`;
  }
  return text;
}

function formatEnum(e: EnumDeclaration): string {
  return e.getText();
}

function generateSignatures(config: Config, project: Project): string {
  let md = '> Auto-extracted exported functions and classes\n\n';

  const byFile: Map<string, string[]> = new Map();

  for (const sourceFile of project.getSourceFiles()) {
    const items: string[] = [];
    const relPath = relative(config, sourceFile.getFilePath());

    for (const func of sourceFile.getFunctions()) {
      if (!func.isExported()) continue;
      items.push(formatFunction(func));
    }

    for (const cls of sourceFile.getClasses()) {
      if (!cls.isExported()) continue;
      items.push(formatClass(cls));
    }

    for (const varStmt of sourceFile.getVariableStatements()) {
      if (!varStmt.isExported()) continue;
      for (const decl of varStmt.getDeclarations()) {
        const init = decl.getInitializer();
        if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
          const name = decl.getName();
          const type = decl.getType().getText(decl);
          const shortType = type.length > 120 ? `${type.substring(0, 120)}...` : type;
          items.push(`export const ${name}: ${shortType}`);
        }
      }
    }

    if (items.length > 0) {
      byFile.set(relPath, items);
    }
  }

  const sorted = [...byFile.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  for (const [filePath, items] of sorted) {
    md += `## \`${filePath}\`\n\n`;
    md += '```ts\n';
    md += items.join('\n\n');
    md += '\n```\n\n';
  }

  if (sorted.length === 0) md += '_No exported functions or classes found._\n';

  return md;
}

function formatFunction(func: FunctionDeclaration): string {
  const name = func.getName() ?? 'anonymous';
  const params = func
    .getParameters()
    .map((p) => `${p.getName()}: ${p.getType().getText(p)}`)
    .join(', ');
  const ret = func.getReturnType().getText(func);
  const isAsync = func.isAsync() ? 'async ' : '';
  return `export ${isAsync}function ${name}(${params}): ${ret}`;
}

function formatClass(cls: ClassDeclaration): string {
  const name = cls.getName() ?? 'AnonymousClass';
  const lines: string[] = [];

  const ext = cls.getExtends();
  const impls = cls
    .getImplements()
    .map((i) => i.getText())
    .join(', ');
  let header = `export class ${name}`;
  if (ext) header += ` extends ${ext.getText()}`;
  if (impls) header += ` implements ${impls}`;
  lines.push(`${header} {`);

  const ctor = cls.getConstructors()[0];
  if (ctor) {
    const params = ctor
      .getParameters()
      .map((p) => `${p.getName()}: ${p.getType().getText(p)}`)
      .join(', ');
    lines.push(`  constructor(${params})`);
  }

  for (const method of cls.getMethods()) {
    if (method.getScope() === 'private' || method.getName().startsWith('_')) continue;
    const params = method
      .getParameters()
      .map((p) => `${p.getName()}: ${p.getType().getText(p)}`)
      .join(', ');
    const ret = method.getReturnType().getText(method);
    const isAsync = method.isAsync() ? 'async ' : '';
    lines.push(`  ${isAsync}${method.getName()}(${params}): ${ret}`);
  }

  lines.push('}');
  return lines.join('\n');
}

function generateInventory(config: Config, project: Project): string {
  let md = '> Auto-generated list of all source files\n\n';
  md += '| Path | Lines | Exports | Top export |\n';
  md += '|------|-------|---------|------------|\n';

  const rows: {
    path: string;
    lines: number;
    exports: number;
    topExport: string;
  }[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const relPath = relative(config, sourceFile.getFilePath());
    const lines = sourceFile.getEndLineNumber();
    const exportedDecls = sourceFile.getExportedDeclarations();
    const exportCount = exportedDecls.size;
    const topExport = exportedDecls.keys().next().value ?? '—';

    rows.push({
      path: relPath,
      lines,
      exports: exportCount,
      topExport: String(topExport),
    });
  }

  rows.sort((a, b) => b.lines - a.lines);

  for (const row of rows) {
    md += `| \`${row.path}\` | ${row.lines} | ${row.exports} | \`${row.topExport}\` |\n`;
  }

  md += `\n**Total:** ${rows.length} files, ${rows.reduce((s, r) => s + r.lines, 0)} lines\n`;

  return md;
}

function generateEnvVars(config: Config, project: Project): string {
  let md = '> Auto-extracted from process.env references in code\n\n';
  md += '| Variable | Files |\n|----------|-------|\n';

  const envMap: Map<string, Set<string>> = new Map();

  const addVar = (varName: string, relPath: string) => {
    if (!envMap.has(varName)) envMap.set(varName, new Set());
    envMap.get(varName)?.add(relPath);
  };

  for (const sourceFile of project.getSourceFiles()) {
    const text = sourceFile.getFullText();
    const relPath = relative(config, sourceFile.getFilePath());

    // Pattern 1: process.env.VAR_NAME
    const directPattern = new RegExp(config.envVarPattern.source, 'g');
    let match = directPattern.exec(text);
    while (match !== null) {
      addVar(match[1] as string, relPath);
      match = directPattern.exec(text);
    }

    // Pattern 2: obj.VAR_NAME = '...' — catches env.TRACEPACT_X = '1' style assignments
    const assignPattern = /\benv\.([A-Z_][A-Z0-9_]*)\s*=/g;
    let assignMatch = assignPattern.exec(text);
    while (assignMatch !== null) {
      addVar(assignMatch[1] as string, relPath);
      assignMatch = assignPattern.exec(text);
    }

    // Pattern 3: envKey: 'VAR_NAME' — catches API key names in provider preset objects
    const envKeyPattern = /\benvKey:\s*['"]([A-Z_][A-Z0-9_]*)['"]/g;
    let envKeyMatch = envKeyPattern.exec(text);
    while (envKeyMatch !== null) {
      addVar(envKeyMatch[1] as string, relPath);
      envKeyMatch = envKeyPattern.exec(text);
    }
  }

  const sorted = [...envMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [varName, files] of sorted) {
    md += `| \`${varName}\` | ${[...files].map((f) => `\`${f}\``).join(', ')} |\n`;
  }

  if (sorted.length === 0) md += '_No process.env references found._\n';

  return md;
}

function generateImportGraph(config: Config, project: Project): string {
  let md = '> Auto-extracted cross-package import dependencies\n\n';

  // Build a map from npm package name → "packages/X" dir so we can resolve
  // named imports like `@tracepact/core` back to a local package.
  const npmNameToLocalPkg = new Map<string, string>();
  const packagesDir = path.join(config.root, 'packages');
  if (fs.existsSync(packagesDir)) {
    for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkgJson = path.join(packagesDir, entry.name, 'package.json');
      if (!fs.existsSync(pkgJson)) continue;
      const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf-8'));
      if (pkg.name) npmNameToLocalPkg.set(pkg.name, `packages/${entry.name}`);
    }
  }

  // Group by package (e.g. "packages/core")
  const pkgDeps: Map<string, Set<string>> = new Map();

  for (const sourceFile of project.getSourceFiles()) {
    const relPath = relative(config, sourceFile.getFilePath());
    // packages/core/src/... → "packages/core"
    const parts = relPath.split('/');
    const sourcePkg = parts[0] === 'packages' ? `${parts[0]}/${parts[1]}` : (parts[0] as string);

    for (const imp of sourceFile.getImportDeclarations()) {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      let targetPkg: string | undefined;

      if (moduleSpecifier.startsWith('.')) {
        // Relative import — resolve via ts-morph
        const resolved = imp.getModuleSpecifierSourceFile();
        if (!resolved) continue;
        const targetPath = relative(config, resolved.getFilePath());
        const tparts = targetPath.split('/');
        targetPkg = tparts[0] === 'packages' ? `${tparts[0]}/${tparts[1]}` : (tparts[0] as string);
      } else {
        // Named import — check if it's a local workspace package
        // Handle scoped names like `@tracepact/core` as well as plain `core`
        targetPkg = npmNameToLocalPkg.get(moduleSpecifier);
        if (!targetPkg) continue;
      }

      if (sourcePkg !== targetPkg) {
        if (!pkgDeps.has(sourcePkg)) pkgDeps.set(sourcePkg, new Set());
        pkgDeps.get(sourcePkg)?.add(targetPkg);
      }
    }
  }

  if (pkgDeps.size === 0) {
    md += '_No cross-package imports detected._\n';
    return md;
  }

  // Mermaid diagram
  md += '```mermaid\ngraph TD\n';
  const nodeIds = new Map<string, string>();
  let counter = 0;
  const getId = (name: string): string => {
    if (!nodeIds.has(name)) nodeIds.set(name, `M${counter++}`);
    return nodeIds.get(name) as string;
  };

  for (const [source, targets] of pkgDeps) {
    for (const target of targets) {
      md += `  ${getId(source)}["${source}"] --> ${getId(target)}["${target}"]\n`;
    }
  }
  md += '```\n\n';

  md += '## Import table\n\n';
  md += '| Package | Depends on |\n|---------|------------|\n';
  const sortedDeps = [...pkgDeps.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [source, targets] of sortedDeps) {
    md += `| \`${source}\` | ${[...targets]
      .sort()
      .map((t) => `\`${t}\``)
      .join(', ')} |\n`;
  }

  return md;
}

// ─── Per-section generated blocks ──────────────────────────────────────────

/**
 * Extracts signatures (interfaces, type aliases, enums, functions, classes)
 * from a specific set of relative file paths within the project.
 * Generates markdown with TypeScript code blocks, one per file.
 */
function extractSignaturesForFiles(config: Config, project: Project, relPaths: string[]): string {
  const parts: string[] = [];

  for (const relPath of relPaths) {
    const absPath = path.resolve(config.root, relPath);
    const sourceFile = project.getSourceFile(absPath);
    if (!sourceFile) continue;

    const items: string[] = [];

    for (const iface of sourceFile.getInterfaces()) {
      if (!iface.isExported()) continue;
      items.push(formatInterface(iface));
    }

    for (const typeAlias of sourceFile.getTypeAliases()) {
      if (!typeAlias.isExported()) continue;
      items.push(formatTypeAlias(typeAlias));
    }

    for (const enumDecl of sourceFile.getEnums()) {
      if (!enumDecl.isExported()) continue;
      items.push(formatEnum(enumDecl));
    }

    for (const func of sourceFile.getFunctions()) {
      if (!func.isExported()) continue;
      items.push(formatFunction(func));
    }

    for (const cls of sourceFile.getClasses()) {
      if (!cls.isExported()) continue;
      items.push(formatClass(cls));
    }

    for (const varStmt of sourceFile.getVariableStatements()) {
      if (!varStmt.isExported()) continue;
      for (const decl of varStmt.getDeclarations()) {
        const init = decl.getInitializer();
        if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
          const name = decl.getName();
          const type = decl.getType().getText(decl);
          const shortType = type.length > 120 ? `${type.substring(0, 120)}...` : type;
          items.push(`export const ${name}: ${shortType}`);
        }
      }
    }

    if (items.length > 0) {
      parts.push(`### \`${relPath}\`\n\n\`\`\`ts\n${items.join('\n\n')}\n\`\`\``);
    }
  }

  return parts.length > 0 ? parts.join('\n\n') : '_No exported symbols found._';
}

/**
 * Scans all components-*.md files in config.outDir, finds every
 * <!-- SOURCES: ... --> / <!-- BEGIN:GENERATED --> / <!-- END:GENERATED -->
 * triplet, and replaces the generated block content with fresh signatures
 * extracted from the listed source files.
 */
function processComponentFiles(config: Config, project: Project): void {
  const pattern =
    /<!-- SOURCES: ([^\n>]+) -->\n<!-- BEGIN:GENERATED -->([\s\S]*?)<!-- END:GENERATED -->/g;

  const mdFiles = fs
    .readdirSync(config.outDir)
    .filter((f) => /^components-.*\.md$/.test(f))
    .map((f) => path.join(config.outDir, f));

  for (const filePath of mdFiles) {
    const original = fs.readFileSync(filePath, 'utf-8');
    let updated = false;

    const replaced = original.replace(pattern, (_match, rawPaths: string) => {
      const relPaths = rawPaths
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      const content = extractSignaturesForFiles(config, project, relPaths);
      const note = '_Auto-generated from code — do not edit this block manually._\n\n';

      updated = true;
      return `<!-- SOURCES: ${rawPaths} -->\n<!-- BEGIN:GENERATED -->\n${note}${content}\n<!-- END:GENERATED -->`;
    });

    if (updated) {
      fs.writeFileSync(filePath, replaced);
      console.log(`  ✓ ${path.basename(filePath)} (section blocks updated)`);
    }
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main(): void {
  const config = parseArgs();

  console.log(`Analyzing: ${config.root}`);
  console.log(`Output:    ${config.outDir}`);

  const project = loadProject(config);

  console.log(`Found ${project.getSourceFiles().length} source files`);

  fs.mkdirSync(config.outDir, { recursive: true });

  const files: [string, string, () => string][] = [
    ['shape.md', 'Repository Shape', () => generateShape(config)],
    ['entrypoints.md', 'Entrypoints', () => generateEntrypoints(config, project)],
    ['dependencies.md', 'Dependencies', () => generateDependencies(config)],
    ['interfaces.md', 'Interfaces & Exported Types', () => generateInterfaces(config, project)],
    ['signatures.md', 'Exported Signatures', () => generateSignatures(config, project)],
    ['inventory.md', 'Module Inventory', () => generateInventory(config, project)],
    ['env-vars.md', 'Environment Variables', () => generateEnvVars(config, project)],
    ['import-graph.md', 'Internal Import Graph', () => generateImportGraph(config, project)],
  ];

  let created = 0;
  let updated = 0;
  let appended = 0;

  for (const [name, title, generate] of files) {
    try {
      const content = generate();
      const outPath = path.join(config.outDir, name);
      const result = upsertGeneratedBlock(outPath, content, title);
      const lines = content.split('\n').length;
      const tag = result === 'created' ? '[new]' : result === 'appended' ? '[appended]' : '';
      console.log(`  ✓ ${name} (${lines} lines) ${tag}`.trimEnd());
      if (result === 'created') created++;
      else if (result === 'appended') appended++;
      else updated++;
    } catch (err) {
      console.error(`  ✗ ${name}: ${(err as Error).message}`);
    }
  }

  console.log(
    `\nDone. ${updated} updated, ${appended} appended, ${created} created — ${path.relative(config.root, config.outDir)}/`
  );

  // Process per-section generated blocks in components-*.md
  processComponentFiles(config, project);
}

main();
