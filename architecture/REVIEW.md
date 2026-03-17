# Architecture Design Review

> Generado el 2026-03-17 a partir de review paralelo de los 12 archivos de arquitectura.
> Metodología: un agente Staff-Engineer-level por archivo, con acceso al código fuente. Se consolidaron y deduplicaron hallazgos cruzados.

---

## Tabla resumen

| # | Archivo(s) | Tipo | Título | Severidad |
|---|-----------|------|--------|-----------|
| 1 | drivers, shape, flows, deps | gap | Timeout en `RunConfig` definido pero nunca implementado | alta |
| 2 | components-testing, cross-cutting | gap | Cache y registry sin aislamiento entre tests paralelos | alta |
| 3 | components-tooling | gap | `McpClient.callTool()` puede bloquear indefinidamente sin timeout | alta |
| 4 | interfaces | gap | `RunResult` retorna al caller sin redactar secrets | alta |
| 5 | wiring | gap | API key resolution silently fails — errores se guardan en `initErrors` | alta |
| 6 | wiring | problema_de_diseño | Cache manifest hash imperfect: orden de tools y `jsonSchema` inestable | alta |
| 7 | cross-cutting | gap | Global state mutable sin sincronización en tests paralelos | alta |
| 8 | cross-cutting | gap | `RedactionPipeline` solo redacta vars con nombres conocidos | alta |
| 9 | tooling, interfaces, tech-debt | gap | MCP connections nunca se cierran — resource leak acumulativo | alta |
| 10 | components-testing | problema_de_diseño | Stub matching usa `===` — deep equality silently fails | media |
| 11 | components-testing, cross-cutting | gap | Embedding cache: race condition en requests concurrentes | media |
| 12 | components-tooling | problema_de_diseño | `AuditEngine` silencia excepciones de reglas como findings | media |
| 13 | components-tooling | gap | Cassette path generado solo con prompt hash (no tools) | media |
| 14 | components-tooling | gap | Sin límite de tamaño en cache/cassettes | media |
| 15 | components-tooling, interfaces | gap | Cassette metadata no incluye tool definitions | media |
| 16 | components-drivers | gap | Streaming `for await` sin error handling en ruptura de conexión | media |
| 17 | components-drivers | problema_de_diseño | JSON parse fallido en streaming silenciado — tool args → `{}` | media |
| 18 | components-drivers | inconsistencia | `ContentBlock[]` soportado en Anthropic pero rechazado en OpenAI | media |
| 19 | components-drivers | gap | `healthCheck()` no usa `RetryPolicy` ni semaphore, puede colgar setup | media |
| 20 | interfaces, dependencies | gap | `JudgeExecutor` sin timeout y sin retry en API failures | media |
| 21 | flows | gap | Judge consensus no maneja fallas parciales de votantes | media |
| 22 | wiring | problema_de_diseño | `detectProvider()` tiene orden hardcodeado no configurable | media |
| 23 | wiring | gap | Health check de `setup.ts` sin error propagation: oculta causa real | media |
| 24 | cross-cutting, flows | gap | Token budget se corta mid-loop sin cleanup ni cassette parcial | media |
| 25 | interfaces | gap | Cassette player no valida que tool definitions no cambiaron | media |
| 26 | components-testing, deps | problema_de_diseño | `validateArgs` en `MockSandbox` no valida objetos anidados ni constraints | media |
| 27 | tech-debt | problema_de_diseño | Cassette formato sin versionado ni strategy de migración | media |
| 28 | tech-debt, dependencies | problema_de_diseño | Judge JSON parse failure retorna `pass: false` silenciosamente | media |
| 29 | cross-cutting | problema_de_diseño | `McpClient._connected` mezcla errores de transport con errores de tool | media |
| 30 | entrypoints | problema_de_diseño | Configuración dispersa: cada entrypoint resuelve env vars independientemente | media |
| 31 | tech-debt | problema_de_diseño | `RedactionPipeline.redactObject()` hace `JSON.stringify`+`parse` por run | media |
| 32 | wiring | gap | `initLogLevelFromEnv()` nunca se llama automáticamente desde ningún entrypoint | media |
| 33 | shape, cross-cutting | problema_de_diseño | Logger usa `console.error()` para todos los niveles (debug, info, warn) | baja |
| 34 | tech-debt | gap | Semaphore sin timeout ni observabilidad — deadlock potencial | baja |
| 35 | shape | gap | `ToolTrace` se construye sin validar invariantes de secuencia | baja |
| 36 | shape | gap | `CacheStore` no limpia archivos `.tmp` si el rename falla | baja |
| 37 | shape, interfaces | problema_de_diseño | `RunResult.cacheStatus` es opcional — semántica de `undefined` ambigua | baja |
| 38 | flows | gap | `CassettePlayer` no preserva `usage` fields en replay | baja |
| 39 | tech-debt | problema_de_diseño | Mock mode retorna manifesto con todos los hashes vacíos | baja |
| 40 | flows | problema_de_diseño | Error de mismatch de cassette muestra solo 60 chars, sin diff | baja |
| 41 | components-drivers | problema_de_diseño | `DriverRegistry.register()` no tiene deregister — contamina estado global | baja |
| 42 | interfaces | problema_de_diseño | `MockSandbox.reset()` no es thread-safe si hay tool calls concurrentes | baja |
| 43 | dependencies | problema_de_diseño | `EmbeddingProvider` interface solo tiene una implementación — extensibilidad teórica | baja |
| 44 | components-drivers | gap | No hay medición de duración por tool call — troubleshooting a ciegas | baja |

---

## Detalle de hallazgos

---

### 1. Timeout en `RunConfig` definido pero nunca implementado

- **Tipo:** gap
- **Dónde:** `packages/core/src/driver/types.ts:43`, `packages/core/src/driver/anthropic-driver.ts`, `packages/core/src/driver/openai-driver.ts`
- **Qué:** El campo `timeout?: number` existe en `RunConfig` y es aceptado por todos los entrypoints, pero ningún driver lo implementa. No hay `AbortController`, no se pasa al SDK, no hay `Promise.race()`. El loop de tool calls también corre sin límite acumulativo de tiempo.
- **Por qué importa:** Un agente que entra en loop, un stream que no cierra, o un provider lento cuelga el test indefinidamente. En CI esto bloquea toda la pipeline. El campo genera falsa sensación de que el timeout está activo.
- **Severidad:** alta
- **Sugerencia:** Implementar `AbortController` con timeout en `retry.execute()` y en el `for await` de streaming. Pasar el signal a los SDKs de Anthropic/OpenAI (que lo soportan). Fallar con `DriverError` al expirar.

---

### 2. Cache y registry sin aislamiento entre tests paralelos

- **Tipo:** gap
- **Dónde:** `packages/core/src/driver/execute.ts:18` (`_registryCache`), `packages/core/src/matchers/tier3/embedding-cache.ts:32` (`globalEmbeddingCache`), `packages/vitest/src/token-tracker.ts:4` (`globalTokens`)
- **Qué:** Tres singletons module-level mutables comparten estado entre tests. `setup.ts` limpia `_registryCache` y `globalEmbeddingCache` en `beforeEach`/`afterAll`, pero nada lo garantiza si no se importa el setup. En Vitest con workers, múltiples workers mutarán estos Maps simultáneamente sin protección.
- **Por qué importa:** Tests paralelos pueden usar drivers con credenciales de otro test, ver embeddings calculados por otro test, o acumular tokens de tests que no corren en ese worker. Los reportes son non-determinísticos.
- **Severidad:** alta
- **Sugerencia:** Agregar una validación en `runSkill()` que verifique que el setup fue importado. O encapsular el state en un `TestContext` inyectable en lugar de singletons globales. Como mínimo: documentar explícitamente que tests paralelos requieren workers aislados.

---

### 3. `McpClient.callTool()` puede bloquear indefinidamente

- **Tipo:** gap
- **Dónde:** `packages/core/src/mcp/client.ts:69-101`
- **Qué:** `callTool()` hace `await this.client.callTool()` sobre stdio transport sin timeout. Si el servidor MCP se cuelga, el test espera para siempre.
- **Por qué importa:** Tests con MCP pueden no terminar nunca en CI. Con múltiples tests MCP, un servidor zombie bloquea el worker entero.
- **Severidad:** alta
- **Sugerencia:** Agregar timeout configurable (default 30s) en `McpClientConfig`. Implementar con `Promise.race()` o AbortController.

---

### 4. `RunResult` retorna al caller con secrets sin redactar

- **Tipo:** gap
- **Dónde:** `packages/core/src/driver/execute.ts`, `packages/core/src/cache/cache-store.ts:94`, `packages/core/src/cassette/recorder.ts`
- **Qué:** `RedactionPipeline` se aplica al escribir a disco (cache, cassette), pero el `RunResult` que se retorna al caller desde `executePrompt()` nunca se redacta. Si el usuario loguea el resultado o lo exporta, los secrets del LLM output quedan expuestos.
- **Por qué importa:** Un caller que hace `console.log(result)` o exporta a telemetría filtra API keys que aparecieran en el contexto del LLM. Cassettes subidas a git también están en riesgo si el recorder falla antes de redactar.
- **Severidad:** alta
- **Sugerencia:** Redactar el `RunResult` antes de retornarlo desde `executePrompt()`. O documentar explícitamente como contrato que el caller es responsable de redactar.

---

### 5. API key resolution silently fails — errores en `initErrors`

- **Tipo:** gap
- **Dónde:** `packages/core/src/driver/registry.ts:88-96`
- **Qué:** Si la creación de un driver falla (ej: API key ausente, config inválida), el error se guarda en `initErrors` y la ejecución continúa. El error no se lanza hasta que el driver se usa (`get()`) o se llama `validateAll()`. Si el suite usa solo el provider por defecto y ese es el que falló, puede correr tests y fallar tarde con mensajes confusos.
- **Por qué importa:** Silent failures durante init hacen que el mensaje de error aparezca en el contexto equivocado (dentro de un test en lugar de en el setup).
- **Severidad:** alta
- **Sugerencia:** Llamar a `validateAll()` automáticamente en `setup.ts` o en el primer `executePrompt()`. O hacer que `createDriver()` lance inmediatamente si la config es inválida.

---

### 6. Cache manifest hash inestable — colisiones y misses falsos

- **Tipo:** problema_de_diseño
- **Dónde:** `packages/core/src/driver/execute.ts:115-127`
- **Qué:** El `toolDefsHash` se calcula con `JSON.stringify((opts.tools ?? []).map((t) => ({ name: t.name, schema: (t as any).jsonSchema })))`. Problemas: (1) si las tools vienen en diferente orden entre calls, el hash cambia aunque las tools son las mismas; (2) el cast a `any` sobre `jsonSchema` puede ser `undefined` en algunos tools; (3) un cambio no-semántico en el schema (ej: reordenar propiedades) cambia el hash.
- **Por qué importa:** Cache misses cuando debería ser hit (refactors que reordenan tools). Cache hits cuando debería ser miss (si `jsonSchema` siempre es undefined, todos los tools producen el mismo hash).
- **Severidad:** alta
- **Sugerencia:** Ordenar tools por `name` antes de serializar. Validar que `jsonSchema` existe en todos los tools. Normalizar el schema (ordenar keys) antes de hashear.

---

### 7. Global state mutable sin sincronización en tests paralelos

- **Tipo:** gap
- **Dónde:** `packages/vitest/src/token-tracker.ts:4`, `packages/core/src/driver/execute.ts:18`, `packages/core/src/matchers/tier3/embedding-cache.ts:32`
- **Qué:** `globalTokens`, `_registryCache`, y `globalEmbeddingCache` son mutados por múltiples workers concurrentes sin locks. Ver también hallazgo #2 — este hallazgo lo enfatiza desde la perspectiva de token reporting: los contadores de tokens acumulan de todos los workers, haciendo que el budget check sea incorrecto en modo paralelo.
- **Por qué importa:** El presupuesto de tokens puede agotarse por tokens de otros workers. Tests independientes se afectan mutuamente.
- **Severidad:** alta
- **Sugerencia:** `globalTokens` debería ser per-worker o per-test, no global. Considerar pasar el `TokenAccumulator` como parámetro a `runSkill()` en lugar de usar un singleton.

---

### 8. `RedactionPipeline` solo redacta vars con nombres conocidos

- **Tipo:** gap
- **Dónde:** `packages/core/src/redaction/pipeline.ts:9-38`
- **Qué:** La auto-detección de secrets cubre prefijos hardcodeados (`ANTHROPIC_`, `OPENAI_`, etc.) y sufijos (`_API_KEY`, `_TOKEN`, etc.). Un secret en `THIRD_PARTY_URL` o `MY_SERVICE_PASS` no se redacta. Tampoco se redactan secrets pasados como valores literales en config o prompts.
- **Por qué importa:** Cassettes con secrets de providers custom se suben a git. Logs de CI contienen tokens. Un usuario que no lee la documentación de redacción tiene falsa sensación de seguridad.
- **Severidad:** alta
- **Sugerencia:** (a) Extender auto-detection a valores que parezcan secrets por entropía/longitud (ej. strings base64 > 32 chars). (b) Escanear el `RunResult` output por valores conocidos de todas las env vars declaradas. (c) Documentar con énfasis que secrets hardcoded en prompts no se redactan.

---

### 9. MCP connections nunca se cierran — resource leak

- **Tipo:** gap
- **Dónde:** `packages/vitest/src/run-skill.ts:42-76`, `packages/core/src/mcp/connect.ts`
- **Qué:** `connectMcp()` retorna `McpConnection` con un método `close()`, pero `runSkill()` nunca lo llama. Los subprocesos MCP se quedan vivos al terminar el test. Con muchos tests MCP, se acumulan procesos zombie y file descriptors.
- **Por qué importa:** En CI con muchos tests MCP, puede agotarse el límite de file descriptors o procesos del sistema, causando fallos esporádicos.
- **Severidad:** alta
- **Sugerencia:** Registrar las conexiones en un array y cerrarlas en un hook `afterEach` en `setup.ts`. O hacer que `runSkill()` acepte un `onCleanup` callback y lo popule automáticamente.

---

### 10. Stub matching usa `===` — deep equality silently fails

- **Tipo:** problema_de_diseño
- **Dónde:** `packages/core/src/cassette/player.ts:47-56`
- **Qué:** El matching de stubs compara argumentos con `call.args[key] !== value` (strict equality por referencia). Para objetos anidados o arrays, dos objetos con el mismo contenido no matchean. Si un stub nunca matchea, se ignora silenciosamente.
- **Por qué importa:** Los stubs no se aplican cuando deberían. El test corre sin el stub y nadie lo sabe. En flujos deterministas, esto es un bug silencioso difícil de diagnosticar.
- **Severidad:** media
- **Sugerencia:** Usar `JSON.stringify` para deep equality. Loguear un warning si un stub definido no matcheó ningún call al final de la cassette replay.

---

### 11. Embedding cache: race condition en requests concurrentes

- **Tipo:** gap
- **Dónde:** `packages/core/src/matchers/tier3/embedding-cache.ts:34-65`
- **Qué:** `embedWithCache()` detecta cache misses y lanza requests. En tests paralelos, dos calls concurrentes para los mismos texts ven ambas un cache miss y duplican el request a la API de embeddings. No hay tracking de requests in-flight.
- **Por qué importa:** Duplica costos de API. Si hay budget de tokens, puede excederlo inesperadamente. Con rate limits agresivos, puede causar 429s.
- **Severidad:** media
- **Sugerencia:** Usar un `Map<string, Promise<number[]>>` para requests in-flight. Otros calls para el mismo texto esperan la promesa existente en lugar de duplicar.

---

### 12. `AuditEngine` silencia excepciones de reglas como findings

- **Tipo:** problema_de_diseño
- **Dónde:** `packages/core/src/audit/engine.ts:26-38`
- **Qué:** Cada `rule.check()` está envuelto en try-catch. Si una regla lanza, se devuelve un `AuditFinding` genérico de severidad `'medium'`. El error se pierde. Un bug en una regla produce el mismo output que un hallazgo real.
- **Por qué importa:** Falsa sensación de seguridad. El audit "encuentra algo" cuando en realidad la regla explotó. Imposible distinguir entre error real e incidente de auditoría.
- **Severidad:** media
- **Sugerencia:** Separar findings de regla vs findings de error. Loguear el stack trace con `log.warn()` en caso de excepción, y retornar un finding con `severity: 'error'` que incluya el nombre de la regla que falló.

---

### 13. Cassette path generado solo con prompt hash — colisiones silenciosas

- **Tipo:** gap
- **Dónde:** `packages/vitest/src/run-skill.ts:147-160` (`generateCassettePath`)
- **Qué:** El path del cassette auto-generado hashea solo el prompt. Dos tests con el mismo prompt pero diferentes tool definitions producen el mismo path y se sobrescriben mutuamente.
- **Por qué importa:** Un test puede leer la cassette del otro si el prompt es idéntico. Tests que parecen pasar pueden estar usando datos del test incorrecto.
- **Severidad:** media
- **Sugerencia:** Incluir un hash de los tool names (o el `toolDefsHash` del manifesto) en el path generado.

---

### 14. Sin límite de tamaño en cache ni cassettes

- **Tipo:** gap
- **Dónde:** `packages/core/src/cache/cache-store.ts`, `packages/core/src/cassette/recorder.ts`
- **Qué:** No hay validación de tamaño antes de escribir. Un run con output grande (ej: 10MB de trace) se guarda sin restricción. En CI con histórico de runs, el directorio crece sin límite.
- **Por qué importa:** Puede llenar el disco en CI o en máquinas de desarrollo. Sin warning, es un problema silencioso.
- **Severidad:** media
- **Sugerencia:** Agregar `maxEntrySizeBytes` configurable en `CacheConfig` y `CassetteConfig`. Loguear warning si se excede; opcionalmente rechazar el write.

---

### 15. Cassette metadata no incluye tool definitions

- **Tipo:** gap
- **Dónde:** `packages/core/src/cassette/recorder.ts`, `packages/core/src/cassette/player.ts`
- **Qué:** `CassetteMetadata` no incluye las tool definitions ni un hash de ellas. Si un tool se renombra o cambia su firma después de grabar una cassette, la cassette se reproduce con args obsoletos sin detectar el cambio.
- **Por qué importa:** Refactors de tools rompen cassettes silenciosamente. El test "pasa" en replay pero el comportamiento no refleja el código actual.
- **Severidad:** media
- **Sugerencia:** Agregar `toolDefsHash: string` a `CassetteMetadata`. En `replay()` con `strict: true`, comparar y lanzar si difiere.

---

### 16. Streaming `for await` sin error handling en ruptura de conexión

- **Tipo:** gap
- **Dónde:** `packages/core/src/driver/anthropic-driver.ts:174-210`, `packages/core/src/driver/openai-driver.ts:343-373`
- **Qué:** El `for await` que itera eventos del stream no tiene try-catch. Si la conexión se cae a mitad del streaming, el AsyncIterable lanza una excepción que escapa sin contexto. El estado de parsing (`currentToolJson`, `currentToolUse`, `textBlocks`) queda inconsistente.
- **Por qué importa:** El error se propaga sin contexto de qué parte del stream se había procesado. Imposible distinguir entre timeout de red, error de parsing o falla del provider.
- **Severidad:** media
- **Sugerencia:** Envolver el `for await` en try-catch. En caso de error, loguear el estado parcial (bytes leídos, tool calls completados) y relanzar con contexto.

---

### 17. JSON parse fallido en streaming silenciado — tool args → `{}`

- **Tipo:** problema_de_diseño
- **Dónde:** `packages/core/src/driver/anthropic-driver.ts:201-205`, `packages/core/src/driver/openai-driver.ts:288-294`
- **Qué:** Cuando `JSON.parse(currentToolJson)` falla, el catch asigna `input = {}` silenciosamente. El tool se ejecuta con argumentos vacíos.
- **Por qué importa:** Un tool call con args vacíos por JSON malformado del provider es indistinguible de un tool call legítimo sin args. Los bugs de integración quedan ocultos.
- **Severidad:** media
- **Sugerencia:** Loguear el JSON inválido con `log.warn()` incluyendo nombre del tool y el string fallido. Considerar retornar `is_error: true` al LLM para que lo reintente.

---

### 18. `ContentBlock[]` soportado en Anthropic pero rechazado en OpenAI

- **Tipo:** inconsistencia
- **Dónde:** `packages/core/src/driver/anthropic-driver.ts:136`, `packages/core/src/driver/openai-driver.ts:151-155`
- **Qué:** El tipo `Message.content` acepta `string | ContentBlock[]`. Anthropic lo pasa directamente; OpenAI lanza `DriverError`. El contrato de `AgentDriver` no refleja esta diferencia. La validación ocurre en runtime en OpenAI pero no en Anthropic.
- **Por qué importa:** Un usuario que pasa una conversación con tool calls grabados funciona en Anthropic pero explota en OpenAI con un error poco descriptivo.
- **Severidad:** media
- **Sugerencia:** Decidir el contrato: (a) prohibir `ContentBlock[]` en `conversation` en ambos drivers (validar early), o (b) implementar serialización en OpenAI también. Reflejar el soporte en `DriverCapabilities`.

---

### 19. `healthCheck()` no usa `RetryPolicy` ni semaphore — puede colgar setup

- **Tipo:** gap
- **Dónde:** `packages/core/src/driver/anthropic-driver.ts:303-326`, `packages/core/src/driver/openai-driver.ts:379-402`
- **Qué:** `healthCheck()` llama directamente a `client.messages.create()` sin pasar por `RetryPolicy` ni `Semaphore`, y sin timeout. Si el provider está lento, el setup de la suite queda bloqueado.
- **Por qué importa:** El health check debería ser la operación más rápida y robusta. Si cuelga, nada corre. En CI esto puede bloquear el job indefinidamente.
- **Severidad:** media
- **Sugerencia:** Envolver `healthCheck()` en un timeout corto (ej. 5s con `Promise.race()`). No necesita usar RetryPolicy, pero sí necesita un límite de tiempo.

---

### 20. `JudgeExecutor` sin timeout y sin retry

- **Tipo:** gap
- **Dónde:** `packages/core/src/matchers/tier4/judge.ts:114-169`
- **Qué:** `singleJudge()` llama a `driver.run()` sin `timeout` en config y sin retry si el provider falla. Si la llamada al judge LLM se cuelga o falla, el matcher falla sin posibilidad de recuperación.
- **Por qué importa:** Assertions Tier 4 son costosas. Un blip de red causa falso negativo del test. Sin timeout, los tests que usan judge pueden colgarse.
- **Severidad:** media
- **Sugerencia:** Pasar un `timeout` desde `JudgeConfig` al `driver.run()`. Implementar retry con `RetryPolicy` para errores transitorios de API.

---

### 21. Judge consensus no maneja fallas parciales de votantes

- **Tipo:** gap
- **Dónde:** `packages/core/src/matchers/tier4/judge.ts:89-95`
- **Qué:** Con `consensus: 3`, si los jueces 1 y 2 tienen éxito pero el 3 falla, se lanza un error sin retornar los votos ya completados. No hay retry por votante ni resultado parcial.
- **Por qué importa:** Información valiosa se pierde. El test falla con error genérico y no se sabe si 2 de 3 jueces votaron "pass". No hay forma de saber si fue falla del sistema o del agente.
- **Severidad:** media
- **Sugerencia:** Capturar errores individuales de votantes. Retornar votos obtenidos con indicador de cuántos fallaron. Opcionalmente, reintentar el votante fallido antes de abortar.

---

### 22. `detectProvider()` tiene orden hardcodeado no configurable

- **Tipo:** problema_de_diseño
- **Dónde:** `packages/core/src/driver/resolve.ts:22-32`
- **Qué:** El orden de detección es fijo: openai, anthropic, groq, deepseek, etc. Si un usuario tiene ambas `OPENAI_API_KEY` y `ANTHROPIC_API_KEY`, siempre se elige OpenAI aunque haya configurado un modelo Claude. No hay logging de qué provider fue elegido.
- **Por qué importa:** Comportamiento sorpresivo y difícil de debuguear. "Mis tests usan OpenAI pero yo configuré Anthropic."
- **Severidad:** media
- **Sugerencia:** Loguear con `log.info()` qué provider fue detectado y por qué. Considerar respetar `TRACEPACT_MODEL` como hint adicional para el orden de detección.

---

### 23. Health check de `setup.ts` sin error propagation — oculta causa real

- **Tipo:** gap
- **Dónde:** `packages/vitest/src/setup.ts:35-73`
- **Qué:** El try-catch del bloque de health check solo loguea con `console.error()`. Si falla, el proceso hace `process.exit(4)` sin mostrar el error real. Si `new DriverRegistry()` lanza (ej: config malformada), el usuario ve "Health check failed" pero no sabe qué config está mal.
- **Por qué importa:** Debugging muy difícil. El código de salida 4 es no-estándar y no comunica nada al usuario.
- **Severidad:** media
- **Sugerencia:** Loguear `err.message` y `err.stack` antes del exit. O convertir el bloque en un hook `globalSetup` de Vitest que pueda propagar el error con contexto completo.

---

### 24. Token budget se corta mid-loop sin cleanup ni cassette parcial

- **Tipo:** gap
- **Dónde:** `packages/vitest/src/token-tracker.ts:32-38`, `packages/vitest/src/run-skill.ts:100+`
- **Qué:** `trackUsage()` lanza un Error inmediatamente al exceder el presupuesto, interrumpiendo el driver loop a mitad de una iteración. La cassette no se graba, el `RunResult` parcial se descarta, y el cleanup de recursos no ocurre.
- **Por qué importa:** Imposible reproducir dónde falló. No se sabe qué parte de la ejecución es válida. El estado puede quedar inconsistente si hay side effects de tools ya ejecutadas.
- **Severidad:** media
- **Sugerencia:** Verificar el presupuesto *antes* de cada LLM call (pre-flight check). Si no hay suficiente, abortar con gracia: grabar cassette truncada (marcada como `truncated: true`), retornar `RunResult` con flag `budgetExceeded`.

---

### 25. Cassette player no valida que tool definitions no cambiaron

- **Tipo:** gap
- **Dónde:** `packages/core/src/cassette/player.ts:22-89`
- **Qué:** En replay, se compara el prompt (si `strict: true`) pero no se valida que las tool definitions sean las mismas que cuando se grabó. Un refactor de tool signature produce args obsoletos sin error.
- **Por qué importa:** Un test "pasa" en replay con args que el código real rechazaría. La cassette se desincroniza silenciosamente con el código.
- **Severidad:** media
- **Sugerencia:** Almacenar `toolDefsHash` en `CassetteMetadata` y comparar en `replay()` cuando `strict: true`.

---

### 26. `validateArgs` en `MockSandbox` no valida objetos anidados ni constraints

- **Tipo:** problema_de_diseño
- **Dónde:** `packages/core/src/sandbox/mock-sandbox.ts:25-68`
- **Qué:** Con `strict: true`, solo se validan: required fields presentes y tipos primitivos top-level. No se validan propiedades anidadas, `enum`, `minLength`, `maxLength`, `pattern`, ni `items` de arrays.
- **Por qué importa:** `strict: true` da falsa seguridad. Un tool que espera `{ config: { port: number } }` acepta `{ config: { port: "invalid" } }` sin error en tests, pero falla en producción.
- **Severidad:** media
- **Sugerencia:** Usar una librería de validación JSON Schema (ej: `ajv`) para validación completa cuando `strict: true`. O documentar claramente las limitaciones de la validación actual.

---

### 27. Cassette formato sin versionado ni strategy de migración

- **Tipo:** problema_de_diseño
- **Dónde:** `packages/core/src/cassette/player.ts:22-29`
- **Qué:** El `switch(cassette.version)` solo maneja `case 1`. No hay migradores. Cuando el schema de cassette cambie (inevitable a medida que el formato evolucione), todos los cassettes existentes quedan incompatibles y hay que re-grabarlos todos.
- **Por qué importa:** Un cambio breaking del formato invalida todos los cassettes guardados — potencialmente cientos de archivos en proyectos reales.
- **Severidad:** media
- **Sugerencia:** Implementar migradores versionados (`v1 → v2`, `v2 → v3`) que transformen el cassette al cargar. O adoptar un esquema con optional fields que sea naturalmente evolutivo.

---

### 28. Judge JSON parse failure retorna `pass: false` silenciosamente

- **Tipo:** problema_de_diseño
- **Dónde:** `packages/core/src/matchers/tier4/judge.ts:136-148`
- **Qué:** Si `extractFirstValidJson()` falla, se loguea un warning y se retorna `pass: false, confidence: 0`. El test falla como si el agente hubiera fallado, cuando en realidad el judge no pudo evaluar.
- **Por qué importa:** Falsos negativos silenciosos. El desarrollador dedica tiempo a debuguear el agente cuando el problema era el judge. Sin el output raw del judge, es imposible diagnosticar.
- **Severidad:** media
- **Sugerencia:** Retornar un estado distinguible: `{ pass: false, reason: 'judge_parse_error', rawOutput: '...' }`. Considerar reintentar el judge si el JSON estaba malformado (problema transitorio). Incluir el output raw del judge en el resultado.

---

### 29. `McpClient._connected` mezcla errores de transport con errores de tool

- **Tipo:** problema_de_diseño
- **Dónde:** `packages/core/src/mcp/client.ts:69-101`
- **Qué:** Si `callTool()` falla por cualquier razón (incluyendo "tool no existe"), se marca `_connected = false`. La siguiente llamada falla con "not connected" aunque el servidor esté vivo. El estado de conexión se confunde con el estado de ejecución del tool.
- **Por qué importa:** Un error de tool (esperado, recuperable) invalida la conexión entera. Calls posteriores fallan incorrectamente, haciendo el cliente frágil a errores transitorios.
- **Severidad:** media
- **Sugerencia:** Solo marcar `_connected = false` si el error es claramente de transport (ej: stream cerrado, EPIPE). Errores de tool (`tool not found`, schema mismatch) no deben alterar el estado de conexión.

---

### 30. Configuración dispersa sin contrato entre entrypoints

- **Tipo:** problema_de_diseño
- **Dónde:** `packages/cli/src/commands/run.ts`, `packages/vitest/src/run-skill.ts`, `packages/vitest/src/setup.ts`, `packages/core/src/driver/resolve.ts`
- **Qué:** Cada entrypoint resuelve config independientemente: lee env vars, detecta provider, construye registry. El CLI establece env vars que downstream lee por convención implícita. No hay un `ConfigResolver` centralizado ni un contrato documentado.
- **Por qué importa:** Cambios en cómo se interpreta una env var en un entrypoint no se propagan a los otros. Migrations de config pueden romper silenciosamente algunos paths.
- **Severidad:** media
- **Sugerencia:** Crear una clase `ConfigResolver` que centralice la lectura de env vars y construcción de config. Los entrypoints la consumen en lugar de reimplementar la lógica.

---

### 31. `RedactionPipeline.redactObject()` serializa/deserializa por cada run

- **Tipo:** problema_de_diseño
- **Dónde:** `packages/core/src/redaction/pipeline.ts:50-51`
- **Qué:** Cada resultado que se cachea pasa por `JSON.stringify(obj) → redact(string) → JSON.parse(redacted)`. Para runs con traces grandes, esto serializa el árbol completo dos veces. Los regexes se ejecutan sobre JSON strings, no sobre valores de objeto.
- **Por qué importa:** Escala mal. Con muchos tests, el overhead es O(payload_size) por cada run. No hay forma de redactar selectivamente solo ciertos campos.
- **Severidad:** media
- **Sugerencia:** Implementar un visitor pattern que redacte in-situ sin serializar. O usar redaction lazy (solo al escribir a disco/red, no al retornar el objeto).

---

### 32. `initLogLevelFromEnv()` no se llama automáticamente desde ningún entrypoint

- **Tipo:** gap
- **Dónde:** `packages/core/src/logger.ts:10` (`currentLevel` hardcodeado en `'warn'`), ningún entrypoint la invoca
- **Qué:** La función `initLogLevelFromEnv()` existe pero no se exporta desde `index.ts` ni se llama en `setup.ts`. El nivel de log siempre es `'warn'` por defecto. Los usuarios que setean `TRACEPACT_LOG=debug` no ven efecto a menos que llamen esta función manualmente.
- **Por qué importa:** La observabilidad básica del sistema no funciona out-of-the-box. Debugging es muy difícil sin logs.
- **Severidad:** media
- **Sugerencia:** Llamar `initLogLevelFromEnv()` automáticamente en `setup.ts` (y en CLI al arrancar). Exportarla desde `index.ts`.

---

### 33. Logger usa `console.error()` para todos los niveles

- **Tipo:** problema_de_diseño
- **Dónde:** `packages/core/src/logger.ts:37-50`
- **Qué:** Todos los niveles (debug, info, warn, error) usan `console.error()`. Los logs van íntegramente a stderr. En CI o log aggregators que filtran por severity, todo aparece como ERROR. No hay forma de inyectar un logger custom (ej: winston, pino).
- **Por qué importa:** Imposible redirigir logs. En scripts que capturan stdout/stderr por separado, los logs de información contaminan el stream de error.
- **Severidad:** baja
- **Sugerencia:** Usar `console.log()` para debug/info/warn, `console.error()` solo para error. O exponer una interfaz `Logger` inyectable para que los usuarios puedan usar su propio sistema de logging.

---

### 34. Semaphore sin timeout ni observabilidad — deadlock potencial

- **Tipo:** gap
- **Dónde:** `packages/core/src/driver/semaphore.ts`
- **Qué:** `acquire()` retorna una promesa que espera indefinidamente si `release()` nunca se llama (ej: bug futuro que omita el `finally`). No hay `getQueueLength()` ni forma de observar si hay un cuello de botella.
- **Por qué importa:** Un driver que crashe sin limpiar puede bloquear todos los consumers del semaphore. Sin observabilidad, es imposible saber si la espera es por rate limit legítimo o por deadlock.
- **Severidad:** baja
- **Sugerencia:** Agregar timeout opcional en `acquire()`. Exponer `getQueueLength()` para diagnóstico. Considerar loguear cuando una request espera más de N segundos en la cola.

---

### 35. `ToolTrace` se construye sin validar invariantes

- **Tipo:** gap
- **Dónde:** `packages/core/src/driver/anthropic-driver.ts:275`, `packages/core/src/sandbox/mock-sandbox.ts`
- **Qué:** El `ToolTrace` retornado no verifica que: `totalCalls` coincida con el array de calls, los `sequenceIndex` sean secuenciales sin gaps, o los contadores sean consistentes.
- **Por qué importa:** Un bug en la construcción del trace podría producir traces corruptos que pasan silenciosamente a los matchers, causando resultados falsos.
- **Severidad:** baja
- **Sugerencia:** Agregar un `validateToolTrace()` que chequee invariantes y loguee un warning si detecta inconsistencias.

---

### 36. `CacheStore` no limpia `.tmp` si el rename falla

- **Tipo:** gap
- **Dónde:** `packages/core/src/cache/cache-store.ts:104-119`
- **Qué:** El write-to-tmp + rename pattern es correcto, pero si `rename()` falla, `deleteFile(tmpPath)` falla silenciosamente (`/* ignore */`). Los archivos `.tmp` se acumulan. No hay limpieza al startup.
- **Por qué importa:** En sistemas con muchos fallos de escritura (permisos, disco lleno), el directorio de cache se llena de `.tmp` basura que nunca se limpian.
- **Severidad:** baja
- **Sugerencia:** En el constructor de `CacheStore`, limpiar archivos `.tmp` del directorio. O loguear el fallo de cleanup con `log.warn()`.

---

### 37. `RunResult.cacheStatus` es opcional — semántica de `undefined` ambigua

- **Tipo:** problema_de_diseño
- **Dónde:** `packages/core/src/driver/types.ts:60`
- **Qué:** `cacheStatus?: 'ok' | 'failed'` es opcional. No hay forma de saber si `undefined` significa "no se intentó cachear" o "se cacheó pero no registramos el estado".
- **Por qué importa:** Matchers o callers que dependen del cache status no pueden distinguir entre los casos.
- **Severidad:** baja
- **Sugerencia:** Cambiar a un enum siempre presente: `cacheStatus: 'hit' | 'miss' | 'failed' | 'skipped' | 'cassette_replay'`.

---

### 38. `CassettePlayer` no preserva `usage` fields en replay

- **Tipo:** gap
- **Dónde:** `packages/core/src/cassette/player.ts:65-88`
- **Qué:** El `RunResult` reconstituido asigna `usage` con valores por defecto (0 tokens) si no están en la cassette. `modelVersion` y `seed` también se omiten.
- **Por qué importa:** Tests que dependen de `result.usage.inputTokens` obtienen 0 en replay. Reports de costos basados en cassette replay son incorrectos.
- **Severidad:** baja
- **Sugerencia:** Persistir `usage.inputTokens`, `usage.outputTokens`, y `modelVersion` en `CassetteMetadata` al grabar, y restaurarlos en replay.

---

### 39. Mock mode retorna manifesto con todos los hashes vacíos

- **Tipo:** problema_de_diseño
- **Dónde:** `packages/vitest/src/run-skill.ts:127-143`
- **Qué:** En `mode: 'mock'`, se retorna un `RunResult` con `skillHash: ''`, `promptHash: ''`, `provider: 'mock'`, `model: 'mock'`. Estos valores vacíos violan el invariante de que cada run tiene un manifesto único.
- **Por qué importa:** Si código futuro intenta cachear resultados de mock mode, habría colisiones silenciosas. Además, no se puede debuguear qué skill/modelo se estaba probando.
- **Severidad:** baja
- **Sugerencia:** Computar el manifesto real (con hashes correctos) incluso en mock mode, pero marcar `provider: 'mock'` para evitar que la cache lo sirva.

---

### 40. Error de mismatch de cassette muestra solo 60 chars, sin diff

- **Tipo:** problema_de_diseño
- **Dónde:** `packages/core/src/cassette/player.ts:35-41`
- **Qué:** Al detectar mismatch de prompt, el error solo muestra los primeros 60 caracteres. Si los primeros 60 chars son idénticos y la diferencia está más adelante, el error no da información útil.
- **Por qué importa:** El usuario no puede saber qué cambió sin difear manualmente los archivos.
- **Severidad:** baja
- **Sugerencia:** Mostrar los primeros N caracteres donde difieren los prompts, o un hash de ambos para comparación rápida. En debug level, loguear ambos prompts completos.

---

### 41. `DriverRegistry.register()` sin deregister — contamina estado global

- **Tipo:** problema_de_diseño
- **Dónde:** `packages/core/src/driver/registry.ts:30-32`
- **Qué:** `registerDriver()` mutea el Map global `NATIVE_DRIVERS`. No hay `unregister()`. Un driver registrado en un test persiste para todos los tests siguientes, sin forma de limpiar.
- **Por qué importa:** Tests que registran drivers custom contaminan el estado global. Si dos tests usan diferentes drivers para el mismo provider name, el segundo test falla inesperadamente.
- **Severidad:** baja
- **Sugerencia:** Agregar `DriverRegistry.unregister(name)`. Llamarlo en `afterEach` si se registraron drivers custom. O cambiar a registro por instancia en lugar de global.

---

### 42. `MockSandbox.reset()` no es thread-safe

- **Tipo:** problema_de_diseño
- **Dónde:** `packages/core/src/sandbox/mock-sandbox.ts:149-152`
- **Qué:** `TraceBuilder.reset()` limpia `this.calls` y `this.index`. Si un test ejecuta tool calls concurrentes dentro del mismo agent loop y alguien llama `reset()` entre ellas, la trace se corrompe con indexing incorrecto.
- **Por qué importa:** Aunque raro, puede causar bugs sutiles en tests avanzados que usan `reset()` manualmente.
- **Severidad:** baja
- **Sugerencia:** Documentar que `reset()` no es thread-safe. O hacer que `TraceBuilder` sea inmutable (retornar un nuevo builder en cada `reset()`).

---

### 43. `EmbeddingProvider` interface con una sola implementación — extensibilidad teórica

- **Tipo:** problema_de_diseño
- **Dónde:** `packages/core/src/matchers/tier3/embeddings.ts`, `packages/core/src/matchers/tier3/index.ts`
- **Qué:** `EmbeddingProvider` es una interface pública con una sola implementación bundled (`OpenAIEmbeddingProvider`). El modelo está hardcodeado (`text-embedding-3-small`, `dimensions: 1536`). No hay ejemplo de cómo implementar un provider custom ni está probado.
- **Por qué importa:** La interface sugiere extensibilidad que no está documentada ni probada. Usuarios que intentan pasar un provider custom no tienen guía.
- **Severidad:** baja
- **Sugerencia:** O documentar el patrón de extensión con un ejemplo, o hacer el modelo/dimensiones configurables vía `OpenAIEmbeddingProvider` constructor. Marcar la interface como `@experimental` si no está lista.

---

### 44. No hay medición de duración por tool call

- **Tipo:** gap
- **Dónde:** `packages/core/src/driver/anthropic-driver.ts:252-264`, `packages/core/src/driver/openai-driver.ts:279-304`
- **Qué:** Se mide tiempo total del run con `performance.now()`, pero dentro del loop de tool calls no hay timestamp por iteración. Si el agente hace 20 iteraciones, no se sabe cuál fue lenta ni si el cuello de botella está en LLM latency o en sandbox latency.
- **Por qué importa:** Troubleshooting de tests lentos requiere adivinar sin datos. Impossible determinar si la latencia es del provider o del sandbox.
- **Severidad:** baja
- **Sugerencia:** Loguear timestamp antes/después de cada `client.messages.create()` y `sandbox.executeTool()`. Incluir breakdown en `RunManifest` o en un campo `timings` del resultado.
