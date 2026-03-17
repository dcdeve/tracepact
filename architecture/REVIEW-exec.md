# Review Execution Report

> Branch: arch-review/20260317-075717
> Fecha: 2026-03-17

## Resultados

| # | Hallazgo | Resultado | Commit | Detalle |
|---|----------|-----------|--------|---------|
| 1 | Tool descriptions hardcodeadas como `"Tool: <name>"` | TOO_BROAD | — | Requiere 4 archivos: `types.ts`, `define-tools.ts`, `anthropic-driver.ts`, `openai-driver.ts`. Agregar `description?: string` a `TypedToolDefinition`; extender `ToolDefs` para aceptar wrapper `{ schema, description? }`; detectar el wrapper en `defineTools`; usar `t.description ?? \`Tool: ${t.name}\`` en ambos drivers. |
| 2 | `toolDefsHash` calculado diferente pre-run vs post-run | FIXED | `796843d` | `stableStringify` extraída a `run-manifest.ts` — `computeManifest` ahora ordena keys y tools igual que `execute.ts`. |
| 3 | `handleRun` (MCP) usa `execFileSync` síncrono | FIXED | `8293d87` | `execFileSync` → `execFile` promisificado, `handleRun` ahora async. |
| 4 | Judge token double-counting en `globalTokens` | FIXED | `e2fbc15` | `adaptAsyncWithJudgeTokens` pasa `new TokenAccumulator()` como `runTokens` en lugar de `globalTokens`. |
| 5 | `NATIVE_DRIVERS` mutable global + registro post-cache silencioso | FIXED | `4928b69` | `log.warn` emitido cuando `register()` se llama con cache ya poblada; wiring via `_setRegistryCacheChecker()` para evitar import circular. |
| 6 | `handleCapture` path incompatible con `generateCassettePath()` | FIXED | `41eed0e` | `cassette_path?: string` agregado a `captureSchema`; cuando se provee se usa directamente. |
| 7 | `Sandbox` sin `implements` + `ExecutePromptOptions.sandbox` tipado concreto | FIXED | `266ce88` | `implements Sandbox` en las 3 clases; `ExecutePromptOptions.sandbox` cambiado a `Sandbox`. |
| 8 | `RedactionConfig` definida dos veces con shapes distintos | TOO_BROAD | — | Requiere 4 archivos: hacer `config/types.ts` fuente única (fields opcionales), borrar `redaction/types.ts`, actualizar imports en `pipeline.ts` y `builtin-rules.ts`. |
| 9 | `_registryCache` keyed solo por provider name | FIXED | `7a908cc` | Cache key ahora incluye `TRACEPACT_MODEL`; bypass completo cuando `tracepactConfig.model` o `tracepactConfig.providers` están seteados. |
| 10 | `CassetteRecorder.save` no es atómica | FIXED | `eba6b32` | Write-to-tmp + `rename` atómico, con cleanup del `.tmp` en caso de error. |
| 11 | `McpClient.connect()` sin timeout | FIXED | `c8d89af` | `connectTimeoutMs` (default 10s) en `McpClientConfig`; `Promise.race` sobre handshake + `listTools`. |
| 12 | `_connected = true` antes de que `listTools` complete | FIXED | `d8caf43` | `_connected = true` movido al final de `connect()`, después de que `listTools` complete exitosamente. |
| 13 | `RedactionPipeline` captura env al construirse — secrets tardíos nunca redactados | FIXED | `5c24961` | `TracepactJsonReporter` difiere la construcción de `RedactionPipeline` a `onFinished()`. |
| 14 | `JudgeExecutor` bypasa cache, redaction y cassette layers | FIXED | `a2c59d0` | `RedactionPipeline` aplicada a output crudo del driver en `singleJudge()`. Cache/cassette requeriría pasar `TracepactConfig` al constructor — fuera de scope. |
| 15 | `JudgeExecutor.evaluate` voters en serie | FIXED | `138f733` | Loop secuencial reemplazado con `Promise.allSettled` — todos los voters corren concurrentemente. |
| 16 | `toMatchTrajectory` duplica output en criteria del judge | FIXED | `1793f38` | `result.output` removido del string `judgePrompt`; solo la traza queda en `criteria`. |
| 17 | `toHaveFileWritten` hardcodea `'write_file'` | FIXED | `4bbbd82` | Parámetro opcional `writeToolName = 'write_file'` agregado como cuarto argumento. |
| 18 | `toNotHaveHallucinated` sentence splitter naive | FIXED | `03c80f0` | Regex extendido a `/[.!?\n]+|(?:^|\n)\s*[-*•]\s*/m`; "sin frases analizables" retorna `pass: false` con mensaje distinto. |
| 19 | `zodToJsonSchema` implementación propia con fallback silencioso | FIXED | `06f790d` | `console.warn` emitido en la rama `default:` con el tipo Zod no reconocido. |
| 20 | `isAllowedPath` implementado diferente en `ProcessSandbox` y `ContainerSandbox` | FIXED | `76ce92e` | Lógica extraída a `sandbox/glob-utils.ts` compartido; bug de `'*'` en `ContainerSandbox` corregido. |
| 21 | `scanDir` sin límite de recursión ni detección de symlinks | FIXED | `03f8dea` | `statSync` → `lstatSync`; symlinks no se siguen y se saltan silenciosamente. |
| 22 | MCP handlers convierten errores en respuestas exitosas | FIXED | `a9bcb4a` | `replay.ts`, `diff.ts`, `capture.ts` re-lanzan errores de infraestructura. `audit.ts` y `run.ts` mantienen inline error (comportamiento de dominio correcto). |
| 23 | `setup.ts` health check a nivel de módulo con `process.exit(4)` | FIXED | `ac1283e` | Health check movido a `beforeAll`; `process.exitCode = 4` + throw en lugar de `process.exit()`. |
| 24 | `tracepact run` usa `execSync` con string interpolation | FIXED | `284bf45` | `execSync` → `execFileSync('npx', vitestArgs, ...)` — args pasados como array sin interpretación de shell. |
| 25 | `TRACEPACT_BUDGET` / `TRACEPACT_TEST_TIMEOUT` aceptan `NaN` silenciosamente | FIXED | `f72cac3` | `Number.isFinite()` validación; budget inválido lanza `Error`; timeout inválido emite `console.warn` y usa default. |
| 26 | `Object.assign` al mergear conexiones MCP — colisiones sin advertencia | FIXED | `5397c33` | Detección de colisiones de tool names antes del merge; lanza error explícito indicando servers y tool en conflicto. |
| 27 | `generateFromCassette` bypasa `CassettePlayer.load()` | FIXED | `fe57909` | `readFileSync + JSON.parse` reemplazado por `new CassettePlayer(path).load()` — migración aplicada consistentemente. |
| 28 | `FlakeStore` no es atómica para acceso concurrente | FIXED | `38c8403` | Write-to-tmp + `rename` atómico; JSDoc documenta que no es safe para múltiples procesos. |
| 29 | `TRACEPACT_BUDGET` no aplica a judge tokens | FIXED | `0bee635` | `trackUsage` en `adaptAsyncWithJudgeTokens` ahora omite `runTokens`, acumulando judge tokens en `globalTokens`. |
| 30 | `Semaphore.warnTimer` / `healthCheck()` timers nunca cancelados | FIXED | `830ceda` | `clearTimeout(warnTimer)` al resolver semaphore; `.finally(() => clearTimeout(handle))` en ambos drivers. |
| 31 | `globalEmbeddingCache` sin límite de tamaño | FALSE_POSITIVE | — | `clearEmbeddingCache()` ya se llama en `beforeEach` del setup de Vitest — el cache se limpia antes de cada test, nunca acumula entre tests. |
| 32 | `inFlight` de embedding-cache no se limpia en `clearEmbeddingCache()` | FIXED | `d7bcf4f` | `inFlight.clear()` agregado a `clearEmbeddingCache()`. |
| 33 | `healthCheckAll()` secuencial | FIXED | `a68342d` | Loop `for...of await` reemplazado con `Promise.all` — todos los checks corren en paralelo. |
| 34 | `handleListTests` solo escanea dos dirs hardcodeados | FIXED | `4eb062c` | `TRACEPACT_CASSETTE_DIR` leído y agregado a los dirs de búsqueda (con deduplicación). |
| 35 | `Semaphore.timeoutMs` nunca se pasa desde los drivers | FIXED | `6c03156` | `semaphoreTimeoutMs?: number` expuesto en constructores de `AnthropicDriver` y `OpenAIDriver`; pasado al constructor de `Semaphore`. |
| 36 | `__VERSION__` literal no reemplazado en manifest de cache | FIXED | `6cc5097` | Import estático de `package.json` — `pkg.version` usado en `frameworkVersion` y `driverVersion`. |
| 37 | `AuditRule.check` síncrono — extensibilidad para reglas con I/O imposible | TOO_BROAD | — | Requiere 4 archivos: `audit/types.ts` (firma async), `audit/engine.ts` (hacer `audit`/`auditSkill` async), `cli/commands/audit.ts` (await), `mcp-server/tools/audit.ts` (await). Cambio es mecánico pero excede 3 archivos. |
| 38 | `loadCustomCalibration` sin validación de esquema | FIXED | `4e2d75f` | Validación de `Array.isArray(examples)` y shape de cada entry; error incluye path del archivo e índice. |
| 39 | `generateTestFile` escaping incompleto | FIXED | `1142d1c` | `escapeString` delegada a `JSON.stringify(s).slice(1,-1)` con re-escape de `'`. |
| 40 | `CassettePlayer.replay()` hace I/O por cada invocación | FIXED | `76a9b9a` | Cassette cacheado en `cachedCassette` tras primer `load()`; `reload()` expuesto para invalidación explícita. |

## Docs actualizados

- `architecture/cross-cutting.md` — error handling MCP parcialmente corregido, budget ahora cubre judges, RedactionPipeline deferred en reporter
- `architecture/wiring.md` — registry cache key ahora incluye model
- `architecture/interfaces.md` — nueva sección `Sandbox`, nueva sección `McpClientConfig`, nota sobre `ExecutePromptOptions.sandbox`
- `architecture/components-testing.md` — JudgeExecutor concurrent + redaction, `toHaveFileWritten` writeToolName
- `architecture/components-drivers.md` — `semaphoreTimeoutMs` en constructores, `register()` warn on stale cache
- Bloques generados (`signatures.md`, `env-vars.md`, `inventory.md`, `shape.md`, `components-tooling.md`) — regenerados vía `make arch`

## Items pendientes

### TOO_BROAD — requieren trabajo adicional

**#1 — Tool descriptions hardcodeadas (`"Tool: <name>"`)** — alta severidad
- `packages/core/src/tools/types.ts`: agregar `description?: string` a `TypedToolDefinition`; extender `ToolDefs` para aceptar `{ schema: ZodTypeAny | JsonSchema, description?: string }` como valor alternativo
- `packages/core/src/tools/define-tools.ts`: detectar el wrapper form (distinguible porque tiene `schema` key en lugar de `type` key), extraer `description`, propagarlo a `TypedToolDefinition`
- `packages/core/src/driver/anthropic-driver.ts`: `description: t.description ?? \`Tool: ${t.name}\``
- `packages/core/src/driver/openai-driver.ts`: mismo cambio

**#8 — `RedactionConfig` dos fuentes de verdad** — media severidad
- `packages/core/src/config/types.ts`: hacer `rules` y `redactEnvValues` opcionales (`rules?: RedactionRule[]`, `redactEnvValues?: string[]`)
- `packages/core/src/redaction/pipeline.ts`: cambiar import de `'./types.js'` a `'../config/types.js'`
- `packages/core/src/redaction/builtin-rules.ts`: mismo cambio de import
- `packages/core/src/redaction/types.ts`: borrar archivo (ningún caller importa de aquí directamente — confirmado con grep)

**#37 — `AuditRule.check` síncrono** — baja severidad
- `packages/core/src/audit/types.ts`: `check(input: AuditInput): AuditFinding[] | Promise<AuditFinding[]>`
- `packages/core/src/audit/engine.ts`: hacer `audit()` y `auditSkill()` async; `Promise.resolve()` sobre cada `rule.check(input)` en el loop
- `packages/cli/src/commands/audit.ts:34`: agregar `await` antes de `engine.auditSkill(skill)`
- `packages/mcp-server/src/tools/audit.ts:13`: mismo `await`
