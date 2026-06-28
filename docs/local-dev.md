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

## Engineering gateway (Phase 2–3)

The **CLI gateway** is the operator entry point for the full engineering loop. Chat with the **Engineering Lead** agent, which drives grill → PRD → tests → build → **review (advisory)** → report → ship via Mastra tools.

### Direct gateway (manual start)

```bash
npm run gateway
```

### Always-on daemon + chat client (Phase 3)

Start the gateway as a background daemon (persists memory thread in `.mastra/gateway-thread.json`):

```bash
npm run gateway:daemon
```

Connect with the thin chat client:

```bash
npm run chat
```

Health check (with daemon running):

```bash
echo health | nc 127.0.0.1 47821
```

### launchd service (Mac)

1. Copy and edit the plist — replace `REPO_ROOT_PLACEHOLDER` with your repo absolute path:

   ```bash
   sed "s|REPO_ROOT_PLACEHOLDER|$(pwd)|g" ops/launchd/com.michaelos.gateway.plist > ~/Library/LaunchAgents/com.michaelos.gateway.plist
   ```

2. Load the service:

   ```bash
   launchctl load ~/Library/LaunchAgents/com.michaelos.gateway.plist
   ```

3. Unload:

   ```bash
   launchctl unload ~/Library/LaunchAgents/com.michaelos.gateway.plist
   ```

Logs: `./.logs/gateway-daemon.stdout.log` and `gateway-daemon.stderr.log`. The plist contains **no secrets** — the daemon loads `.env` via dotenv at runtime.

Requires `OPENAI_API_KEY`. Build and ship steps also require `CURSOR_API_KEY` when you reach handoff. Optional `DEFAULT_REVIEW_MODEL` overrides the Code Reviewer model tier.

**Gateway commands:**

- `exit` / `quit` — leave the session
- `list` — ask the agent for in-progress work items
- `resume #N` — resume by GitHub issue number
- `jobs` — list recent delegated jobs
- `job <id>` — show job detail (input, output, trace ids)
- `YES` / `NO` — approve or cancel dangerous tools (`run-build`, `ship-docs`, `ship-implementation`)

Planning artifacts land in `docs/prds/` (configurable via `PRDS_DIR`). Work-item state is stored under `.mastra/state/` (gitignored). Jobs and traces live in `.mastra/jobs.db` and `.mastra/traces.db` (gitignored). Conversation memory is stored in `.mastra/mastra.db` (gitignored). Observability JSONL is under `.logs/observability.jsonl` (gitignored). Set `OBSERVABILITY_LEVEL` (`silent` | `minimal` | `standard` | `verbose` | `debug`) in `.env` to control capture verbosity.

See [docs/phase-4-delegation-jobs.md](./phase-4-delegation-jobs.md) for jobs, delegation, and observability.

### Local-only delegation eval (Phase 4)

Requires live API keys — **not run in CI**:

```bash
npm run eval:delegation
```

Asserts delegation machinery via observability (`job.delegated`, `job.started`, `job.completed`) and `jobRegistry`. Jobs run synchronously (no background queue).

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
