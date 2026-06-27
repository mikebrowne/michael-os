# Builder Brief: MichaelOS Foundation (Phase 0 + Phase 1)

## Authoritative references

- Product PRD (wins on conflict): `docs/prds/michael-os-foundation.md`
- Locked decisions: `docs/prds/michael-os-foundation-locked-decisions.md`
- Domain glossary: `CONTEXT.md`
- Decisions: `docs/adr/0001-mastra-runtime.md`, `docs/adr/0002-public-safe-vault-boundary.md`
- Vision: `init.md`
- Backlog: `docs/BACKLOG.md`

## Mission

Deliver a public-safe repository and a minimal, locally runnable MichaelOS runtime on Mastra, with basic Run logging and a fake Demo vault, as a sequence of small reversible commits. Do not build the agent organization.

## Success criteria

1. `git init` is done and the repo is committed as small, isolated, reversible commits.
2. `.gitignore` excludes `.env`, `.env.*` (except `.env.example`), `./.logs/`, `.mastra/`, `config/local.*`, `node_modules/`, any real Vault path, and OS cruft.
3. `.env.example` exists with placeholders only: `OPENAI_API_KEY`, `VAULT_PATH`, `LOG_DIR`, `LOG_LEVEL`. No real values anywhere in history.
4. `AGENTS.md` encodes the ten always-on rules and the dangerous-capabilities approval list as policy.
5. `.cursor/rules/` encodes public-safety, secret-handling, reversibility, and thin-vertical-slice guidance.
6. GitHub Issue templates (bug, feature, spec, capability-idea), a pull-request template, and documented GitHub Projects setup steps exist.
7. CI workflow installs, typechecks, lints, builds, and runs unit tests with zero secrets; a separate gitleaks job scans for secrets.
8. A minimal Mastra app starts locally with `npm run dev`.
9. Folder structure exists for agents, tools, workflows, skills, schemas, scripts, tests, docs, and examples (empty areas hold a short README or `.gitkeep` explaining intent).
10. The Run-logger appends JSONL Run logs to the gitignored log directory.
11. A deterministic demo workflow runs without any model key and emits Run logs.
12. A separate local demo script makes a real OpenAI call using the operator's key; it is not run in CI.
13. The committed Demo vault contains only fake notes; the runtime uses it when `VAULT_PATH` is unset.
14. `docs/local-dev.md` documents Mac mini prerequisites, environment setup, the demo, and where logs land.
15. Unit tests for the Run-logger and the deterministic demo workflow pass with no secrets.
16. If the GitHub CLI is authenticated, the public `michael-os` repo (MIT) is created and pushed; otherwise local commits plus documented push steps remain.

## Read first

- `AGENTS.md` (once created in slice 2), `CONTEXT.md`, the PRD, both ADRs, and the locked-decisions table.

## Locked decisions

See `docs/prds/michael-os-foundation-locked-decisions.md` (LD-01 through LD-09). Do not re-open these during the build.

## Build sequence

Each slice is its own commit and ends with the stated verification. Use TDD where a module has testable behavior (Run-logger, demo workflow).

Phase 0:

1. Init repo and safety baseline — `git init`; `.gitignore`, `LICENSE` (MIT), `.env.example`. Verify: `git status` clean of ignored paths; no real values present.
2. Operating rules — `AGENTS.md` and `.cursor/rules/`. Verify: rules render and reference the public-safety boundary.
3. GitHub tracking readiness — issue templates, pull-request template, Projects setup notes in docs. Verify: templates are valid YAML/markdown.
4. CI and secret scan — CI workflow plus gitleaks job. Verify: workflow files are valid; no secret references in CI.

Phase 1:

5. Scaffold minimal Mastra app — run `npm create mastra` (OpenAI, agents/tools/workflows), trim to one demo agent + one tool + one workflow; pin Node 22.13+ via `engines` in `package.json`. Verify: `npm run dev` starts.
6. Folder structure — establish agents/tools/workflows under the Mastra source plus top-level schemas, scripts, skills, tests, examples, docs with intent READMEs. Verify: structure matches success criterion 9.
7. Run-logger (test-first) — JSONL logger to the gitignored log directory wrapping the Mastra logger. Verify: unit test asserts emitted records.
8. Config/env loader — resolves settings from `.env` + default + optional local override; unset `VAULT_PATH` falls back to the Demo vault; missing required values error clearly. Verify: unit coverage of fallback and error paths.
9. Demo vault and deterministic workflow (test-first) — fake notes under examples; workflow does code-only work and logs. Verify: key-free unit test passes.
10. Local demo script — real OpenAI call using the operator's key, excluded from CI. Verify: runs locally with a key; absent from CI.
11. Mac mini local-dev docs — `docs/local-dev.md`. Verify: a clean-machine reader can set up and run the demo.
12. Create and push GitHub repo — verify `gh auth status`; create public `michael-os` and push, or leave local + push steps.

## Verification

At the end, run the full project gate locally: install, typecheck, lint, build, and unit tests must pass with no secrets present. Confirm the gitleaks scan finds nothing. Confirm `npm run dev` starts and the deterministic workflow writes a Run log under the gitignored log directory.
