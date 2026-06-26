# MichaelOS

Local-first personal AI harness. Public-safe repository; private Vault and runtime state stay outside the repo.

## Quick start

```bash
npm ci
cp .env.example .env   # set OPENAI_API_KEY for npm run demo
npm run dev
npm test
```

See [docs/local-dev.md](docs/local-dev.md) for Mac mini setup and [AGENTS.md](AGENTS.md) for operating rules.

## Documentation

- [CONTEXT.md](CONTEXT.md) — domain glossary
- [init.md](init.md) — full build plan
- [docs/](docs/) — ADRs, PRDs, backlog

## License

MIT
