# PR-based staging, promotion, and rollback (not direct push to main)

Through Phase 4, `ship-implementation` copied a green build out of its git worktree and ran
`git add/commit/push origin main` — a direct push with no staged diff, no review gate beyond an
advisory verdict, and no rollback path. Phase 5 ("run like a professional software-building agency")
replaces this with a **PR-based staging and promotion model**: a green build is **staged** by pushing
the worktree as a `feature/<slug>-<runId>` branch and opening a **GitHub pull request** (via a thin
`GhRunner` wrapping `gh`) whose diff is the reviewable **staged change**; the change is **promoted**
only by **merging that PR to `main`** after all gates pass (CI, code review, security review,
permission review — see ADR 0008) and the operator approves (YES), with gate **overrides recorded**;
and any promotion is **reversible via `git revert`** of the merge/promotion commit (forward-only
history, never a force-push), surfaced as a `rollback #N` command. Promotions are tracked in a thin
**`promotionRegistry` / `PromotionRecord`** projection over git (same pattern as
`jobRegistry`/`JobRecord`) recording the commit SHA, the linked Issue/WorkItem and
`build-verification` Job, and which gates passed or were overridden — giving one-command rollback and
an auditable promotion ledger. `git` and `gh` sit behind `GitRunner`/`GhRunner` anti-corruption
wrappers so the mechanism is injectable and version churn is a localized edit; staging/promotion/
rollback are **management-only** dangerous tools (operator YES required), keeping the
authority/clearance model from Phase 4. The trade-off is a new dependency on `gh`/network and more
moving parts than a direct push; we accept this because GitHub is the build system of record, a PR is
the natural reviewable artifact, and revert-based rollback plus a promotion ledger make every change
reversible and auditable. Docs (`ship-docs`) continue to land on `main` directly — the pipeline is
implementation-only.

Considered alternatives: **keep direct push to `main`** — rejected; it has no staged diff, no real
gate, and no clean rollback, which is the entire point of Phase 5. **Local staging branch with
fast-forward promotion (no GitHub/`gh`)** — rejected as the default; it avoids the network dependency
but loses CI-on-PR and the public reviewable artifact, and is less "professional agency"; the
`GitRunner`/`GhRunner` seam plus a local **bare-repo fake remote** in tests recovers offline,
zero-secret testability without giving up real PRs. **Rollback via `git reset --hard` / force-push**
— rejected; it rewrites shared history and violates the reversibility rule; `git revert` is
forward-only and safe. **Derive promotion history from git/PR logs only (no ledger)** — rejected;
rollback and gate/override auditing become fiddly, and a thin `PromotionRecord` projection mirrors the
proven `JobRecord` pattern. **Auto-merge on green** — deferred to Phase 5b; promotion stays
human-in-the-loop (operator YES) this phase.
