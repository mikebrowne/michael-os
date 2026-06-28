# QA Engineer verification model (consolidated gates, deterministic workflow)

Phase 5 needs four promotion gates — CI, code review, security review, and permission review — before
a staged change (ADR 0007) may be promoted. Rather than wiring four independent sub-agents into the
Engineering Lead, we **upgrade the Phase 4 Code Reviewer into a single `qa-engineer` agent** ("QA
Engineer") that owns all gates and returns **one composite verdict**, so the EL delegates a single
**`build-verification` Job** and folds the result into the D+ report as **one operator promotion
blocker** (YES/NO, with per-gate override that is logged). Crucially, the QA Engineer does **not**
freely decide which gates to run: the **gate-set ordering is deterministic** — a Mastra **workflow**
(CI → permission scan → code review → security review → aggregate) — so a gate can never be silently
skipped, honoring the determinism ratchet in `CONTEXT.md`. Within that fixed ordering, **deterministic
gates are tools** (the **CI gate** runs the real validation suite — the LLM never *claims* it passed,
same rule as `run-build`; the **permission scan** is a pure diff scanner for new dangerous
capability) and **judgment gates are skills** (**code review** and **security review**, with distinct
prompts producing distinct findings, so separation of concerns survives inside one agent). The QA
Engineer is an **employee**: it can *assess* but structurally **cannot** stage, promote, merge,
rollback, or restart — only the management EL can, and only with operator YES — making separation of
duties a structural property, not a convention. "QA Engineer" is modeled as a **role that accretes
more skills over time** (regression checks, acceptance verification, perf/accessibility), with the
four gates as its first skills/tools; the Phase 4 `code-review` Job kind becomes a **gate within**
the `build-verification` Job kind, whose output is a composite `{ gates: [{kind, status, findings}],
overall }`. The trade-off is that one agent now spans judgment and deterministic work and could in
principle be a single point of failure for verification; we accept this because the deterministic
workflow guarantees gate coverage, the employee/management split bounds its authority, and the
composite Job stays a clean `(input, output)` tuple for future evals.

Considered alternatives: **separate sub-agent per gate** (EL delegates to Code Reviewer, Security
Reviewer, etc. independently) — rejected as the default; it multiplies the EL's delegation surface and
the operator's decision points for no Phase 5 benefit, though the skills remain individually
splittable into their own agents later (reversible) if independent sign-off is ever required.
**One verifier agent that orchestrates gates probabilistically (skills only, no fixed workflow)** —
rejected; a judgment agent could skip or reorder a security check, which is exactly the failure a
"professional agency" must prevent; the deterministic workflow removes that risk. **Make CI/permission
checks LLM-narrated** — rejected; build/scan status comes only from the real tool output, never from
chat text (consistent with ADR 0005). **Keep verdicts advisory (Phase 4 behavior)** — rejected;
Phase 5 upgrades gates to blocking-by-default with an accountable, logged operator override.
