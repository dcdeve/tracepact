# Claude Code Rules — TracePact

## Plan Workflow

This project uses a `plan/` directory (gitignored) as the single source of truth for development progress.

### On every session:
1. **Read `plan/STATUS.md` first** — it tells you the current phase, step, and what to do next
2. **Read the relevant `TASKS.md`** to understand the current step's exit criteria before coding
3. **If you need implementation details**, read the relevant `SPEC.md`
4. **Before making architectural decisions**, check the relevant `DECISIONS.md`

### During work:
- **Update `plan/STATUS.md` after every meaningful change** — not just at end of session. If you fixed a bug, added tests, changed tooling, or completed a task, update STATUS.md immediately. Do NOT batch updates.
- **Check off completed steps** in the relevant `TASKS.md` as you go.

### After completing work:
1. **Verify `plan/STATUS.md` is current** — if not already updated, do it now
2. **After milestones**, add an entry to `plan/CHANGELOG.md`
3. **If you made an irreversible architectural decision**, record it in the relevant `DECISIONS.md`

### Plan directory structure:
```
plan/
├── STATUS.md              ← ALWAYS READ FIRST
├── CHANGELOG.md           ← milestone history
├── PLAN.md                ← high-level roadmap
└── phase-N/               ← one folder per major phase (phase-0, phase-1, …)
    ├── SPEC.md            ← full spec for the entire phase
    ├── INDEX.md           ← sub-phase index (summary, dependency chain, test targets)
    └── phase-Na/          ← iteration subfolder (a, b, c, …)
        ├── SPEC.md        ← spec for this iteration
        ├── TASKS.md       ← ordered checklist with exit criteria
        └── DECISIONS.md   ← irreversible decisions + rationale
```

### Task markers:
- `[ ]` not started
- `[x]` complete
- `[~]` in progress (with note)
- `[!]` blocked (with note)

## Project

- **Stack:** TypeScript, Node 22, npm workspaces
- **Packages:** `@tracepact/core`, `@tracepact/vitest`, `@tracepact/cli`, `@tracepact/promptfoo` (Phase 1C)
- **Build:** tsup
- **Lint:** Biome
- **Test:** Vitest
- **Language:** Code and commits in English. Communicate with the user in Spanish.
