# Objective

Add `src/utils/greet.ts` with `greet(name: string)` returning `Hello, {name}!`.

# Background

Phase 2 gateway smoke test — thin vertical slice proving the engineering loop handoff to Cursor.

# Requirements

- Create `src/utils/greet.ts`.
- Export `greet(name: string): string`.
- Return `Hello, {name}!` for any string input.
- Empty string input returns `Hello, !`.

# Acceptance Criteria

- `greet("World")` returns `Hello, World!`
- `greet("")` returns `Hello, !`
- Hash-locked acceptance test in `tests/acceptance/agent-build.test.ts` passes without modification.

# Technical Notes

- TypeScript, ESM, Vitest.
- Do not modify `tests/acceptance/agent-build.test.ts`.
- Cursor may add unit tests under `tests/` in its inner loop.

# Out of Scope

- CLI, API, new dependencies, unrelated files.

# Verification Commands

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Test Plan

One hash-locked acceptance test verifies observable greeting behavior for a normal name and an empty string. Cursor writes additional unit tests if needed.
