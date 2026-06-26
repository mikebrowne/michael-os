# Local development (Mac mini)

MichaelOS runs locally on the operator's machine. This guide covers a clean setup.

## Prerequisites

- Node.js 22.13+ (see `.nvmrc`; required by Mastra 1.x)
- npm 10+
- Git

Optional for GitHub push: [GitHub CLI](https://cli.github.com/) (`gh`) authenticated.

## Setup

1. Clone the repository and install dependencies:

   ```bash
   npm ci
   ```

2. Copy environment template and configure locally (never commit `.env`):

   ```bash
   cp .env.example .env
   ```

3. Set `OPENAI_API_KEY` in `.env` for the local demo script (`npm run demo`). CI does not use this key.

4. Leave `VAULT_PATH` unset to use the committed **Demo vault** at `examples/demo-vault/`. To point at your real Vault, set an absolute path outside the repo.

## Run the harness

Start the Mastra dev server:

```bash
npm run dev
```

Run the local demo (deterministic workflow + live OpenAI agent call):

```bash
npm run demo
```

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

Enable **Secret scanning push protection** in the repository settings (see `docs/BACKLOG.md` BL-002).

## Private config

- `.env` — secrets and paths (gitignored)
- `config/local.json` — optional local overrides (gitignored; copy from `config/default.json` pattern)

Tracked defaults live in `config/default.json` and `.env.example` only.
