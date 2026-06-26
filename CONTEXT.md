# MichaelOS

A local-first, public-safe personal AI harness. The public repository holds the runtime, agents, tools, and engineering rails; the operator's private knowledge and runtime state stay outside the repo.

## Language

**MichaelOS** (a.k.a. **the harness**):
The local-first runtime and the organization of agents/tools/workflows it hosts. Built in public; runs privately on the operator's machine.
_Avoid_: "the app", "the bot", "the system"

**Vault**:
The operator's private knowledge store (a real Obsidian vault) living entirely outside the tracked repo and referenced only by a `VAULT_PATH` configured in `.env`. Never committed.
_Avoid_: "notes folder", "knowledge base" (when meaning the private one)

**Demo vault**:
A small, fully fake, public-safe sample vault committed at `examples/demo-vault/` and used by tests and local demos. Contains no real or sensitive data.
_Avoid_: "test vault", "sample data" (use "demo vault" specifically)

**Operator**:
The single human who owns and runs the harness on their own hardware (the Mac mini). There is one operator.
_Avoid_: "user", "customer", "account"

**Run log**:
A structured (JSONL) record of a runtime execution written to the gitignored `./.logs/` directory. Local-only, never committed.
_Avoid_: "trace" (reserved for richer Mastra telemetry), "audit log"

## Example dialogue

> **Dev:** When the demo runs, does it read the operator's vault?
> **Michael:** No — the demo and tests only ever touch the *demo vault* in `examples/demo-vault/`. The real *vault* is private; the harness only reaches it when `VAULT_PATH` points outside the repo, and that path is never committed.
> **Dev:** And where do run logs go?
> **Michael:** Run logs are JSONL under `./.logs/`, which is gitignored. Nothing about a run reaches the public repo.
