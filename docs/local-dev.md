# Local development (Mac mini)

MichaelOS runs locally on the operator's machine. This guide covers a clean setup.

## Prerequisites

- Node.js 22.13+ (see `engines` in `package.json`; required by Mastra 1.x)
- npm 10+
- Git

Optional: [GitHub CLI](https://cli.github.com/) (`gh`) for creating issues or opening PRs from the terminal. The web UI works fine without it.

## Setup

1. Clone the repository and install dependencies:

   ```bash
   npm ci
   ```

2. Copy environment template and configure locally (never commit `.env`):

   ```bash
   cp .env.example .env
   ```

3. Set `OPENAI_API_KEY` in `.env` for the local demo script (`npm run demo`) and spec agent (`npm run agent:build`). CI does not use this key.

4. Set `CURSOR_API_KEY` in `.env` for the Cursor coding executor (`npm run agent:build`). Obtain from [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations). CI does not use this key.

5. Leave `VAULT_PATH` unset to use the committed **Demo vault** at `examples/demo-vault/`. To point at your real Vault, set an absolute path outside the repo.

## Run the harness

Start the Mastra dev server:

```bash
npm run dev
```

Run the local demo (deterministic workflow + live OpenAI agent call):

```bash
npm run demo
```

Run the spec-to-Cursor build loop (requires `OPENAI_API_KEY` and `CURSOR_API_KEY`):

```bash
npm run agent:build -- "Your plain English build request"
```

Artifacts land in gitignored `./ai-runs/`; see [docs/adr/0003-cursor-coding-executor.md](./adr/0003-cursor-coding-executor.md).

## Engineering gateway (Phase 2)

The **CLI gateway** is the operator entry point for the full engineering loop. Chat with the **Engineering Lead** agent, which drives grill → PRD → tests → build → report → ship via Mastra tools.

```bash
npm run gateway
```

Requires `OPENAI_API_KEY`. Build and ship steps also require `CURSOR_API_KEY` when you reach handoff.

**Gateway commands:**

- `exit` / `quit` — leave the session
- `list` — ask the agent for in-progress work items
- `resume #N` — resume by GitHub issue number
- `YES` / `NO` — approve or cancel dangerous tools (`run-build`, `ship-docs`, `ship-implementation`)

Planning artifacts land in `docs/prds/` (configurable via `PRDS_DIR`). Work-item state is stored under `.mastra/state/` (gitignored). Conversation memory is stored in `.mastra/memory.db` (gitignored) — see [ADR 0006](./adr/0006-gateway-session-memory.md). Dangerous tools pause for **code-enforced** operator approval before executing.

See [docs/phase-2-engineering-loop.md](./phase-2-engineering-loop.md) for the north star and architecture.

## Run logs

Structured **Run logs** are JSONL files under `./.logs/` (gitignored). Each run records workflow and demo events.

## Verification (no secrets)

These commands must pass without any API keys:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## GitHub repository

If `gh` is not installed, create the public `michael-os` repository on GitHub manually, then:

```bash
git remote add origin git@github.com:<your-user>/michael-os.git
git push -u origin main
```

Enable **GitHub push protection** (native secret scanning) per [docs/push-to-github.md](./push-to-github.md). This is separate from the **Gitleaks** job in CI, which scans git history on every push.

## Private config

- `.env` — secrets and paths (gitignored)
- `config/local.json` — optional local overrides (gitignored; copy from `config/default.json` pattern)

Tracked defaults live in `config/default.json` and `.env.example` only.
