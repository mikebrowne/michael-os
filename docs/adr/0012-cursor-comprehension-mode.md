# Cursor harness for codebase comprehension and reuse discovery (read-only mode)

Cursor has heavily optimized its agent harness for **codebase reasoning** — indexing, semantic
retrieval, multi-hop "what connects to what," navigation — not only for writing code. Today MichaelOS
uses that harness for exactly one thing: the Software Engineer *writing* code via `runAgentBuild`. Two
engineering tasks that otherwise pull the operator back to the IDE are fundamentally **read** tasks
the same harness is excellent at: **(1) integration mapping** — understanding structure and where a
change plugs in (the "plan" half of plan-mode), and **(2) reuse discovery** — deciding whether
something is *already built* before building it (the framework-first rule, and the core of the
Phase 4b Engagement Manager's build-vs-reuse triage). **Decision:** treat the Cursor SDK as a shared
**codebase reasoning capability with two authority-gated modes** behind the existing `CodingExecutor`
seam — a **read-only comprehension mode** (map structure / find existing / plan integration) and the
existing **implementation mode** (writes code). Comprehension mode has **no side effects** and is
therefore **employee-safe**, so many agents may hold it (Engineering Lead planning, the Debugger,
the Skill Engineer's "does a tool exist before `request-tool-build`," the Engagement Manager's reuse
triage); implementation mode writes code and stays **management-gated** behind the dangerous-tool
approval flow. Comprehension runs the SDK in native **`mode: "plan"`** (`AgentModeOption`), which is
designed to reason/plan without implementing — a natural fit for read-only reasoning. Three guardrails
make it safe and cheap: **(a) read-only is enforced by the environment** — comprehension runs in a
disposable worktree whose writes are discarded — not merely by the prompt or by trusting `mode: "plan"`
(verify its exact write behavior in the installed version); **(b) cite-and-verify** — comprehension
output is *judgment*, so it must cite the
files/symbols it found and the harness then **deterministically verifies** the citation (path/symbol
exists), converting a fuzzy claim into a checkable one (the same red/green discipline as acceptance
hashes); **(c) cost discipline via the determinism ratchet** — every SDK call is a full agent run
(money + latency), so comprehension is reserved for judgment-heavy multi-hop questions while cheap
lookups use `Grep`/`Glob` and the registries (`agentRegistry` / `skillRegistry` / tool list). "Does
this already exist?" thus decomposes into three sources: **registries (deterministic), comprehension
(judgment), and the web (external / framework-first)** — and we already own the deterministic third.
The wrapper stays a thin anti-corruption layer so Cursor SDK churn remains a localized edit.

Considered alternatives: **hand-roll a codebase RAG / embeddings index** for comprehension — rejected
by framework-first; Cursor already optimized multi-hop code reasoning, and a bespoke index would be a
weaker, higher-maintenance reimplementation. **Use only Mastra file/search tools + registries** —
rejected as insufficient for genuine multi-hop integration questions, though they remain the correct
*cheap* path for lookups (and the registries are the deterministic half of reuse discovery). **Make
comprehension a management-gated capability like implementation** — rejected; reads have no side
effects, so gating them needlessly would deny the Debugger / Skill Engineer / Engagement Manager a
safe and central capability. **Trust comprehension output as ground truth** — rejected; it is
probabilistic, so we require cite-and-verify and treat it as advisory. **Always reach for Cursor for
any code question** — rejected on cost/latency; the determinism ratchet routes cheap questions to
`Grep`/registries. **Fold comprehension into the SWE agent only** — rejected; the insight is that the
Cursor *harness* is a shared capability, not the private ability of one role. The trade-off is added
SDK surface and per-call cost; we accept it because read-only comprehension is what makes planning,
debugging, and reuse triage possible in-loop, and the environment + cite-and-verify + ratchet
guardrails contain the risk and the spend.
