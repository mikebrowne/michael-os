# Delegation rework — decision report (non-technical)

**Status: implemented** (2026-06-28). See [phase-4 north star](./phase-4-delegation-jobs.md).

A short, plain-language report on what broke, what we learned, and the decisions
needed to get delegation working correctly **with the right tests**. Some of these
**update earlier Phase 4 decisions** ([phase-4 north star](./phase-4-delegation-jobs.md)).

## What happened

We asked the system to review a piece of code. It went quiet for several minutes —
no answer, no error. Our observability ("flight recorder") showed the review was
handed off to a background queue, but **nothing was running to pick it up**, so it
sat there forever. Like dropping a ticket in a slot for a shop with no staff.

## What we learned

1. **The broken part was "where the work runs," not "who does it."** The Code
   Reviewer was always going to do the review; the failure was that we told it to run
   "later, in the background" with no worker actually draining that queue.
2. **Our tests checked a practice version, not the real one.** They passed because
   they exercised the simple "run it now" path, while production used the background
   path that nobody tested.
3. **We may be hand-rolling something the framework already gives us.** Mastra has a
   built-in way for one agent to call another (sub-agents). The bug lived precisely in
   the custom layer we wrapped around it.

## Decisions needed

Each decision lists the choice, the recommendation, and what (if anything) it
**changes from before**.

### D1 — How should a review run: now, or in the background?

- **Recommendation: run it now and wait.** It's reliable, it's what the chat already
  does anyway (you wait a few seconds), and it removes the freeze entirely.
- **Changes from before:** Yes. Earlier we decided execution would be **async via a
  background queue** (Phase 4 Decision 5). We're walking that back for interactive use.
  Background execution is deferred until we genuinely have "walk away and come back"
  work — and when we add it, it must ship with a test proving the queue actually drains.

### D2 — How should the lead hand off: a built-in tool, or a true sub-agent?

- **Recommendation: lean on Mastra's sub-agent feature as the mechanism**, and keep the
  simple deterministic hand-off as the reliable default for now. The reviewer is already
  wired as the lead's sub-agent; we just haven't leaned on it.
- **Changes from before:** Refines, not reverses. We always intended Mastra supervisor
  agents for delegation (Phase 4 Decision 4) and "the lead decides to delegate" as the
  north star (Decision 7). This says: **don't build our own "agent calls agent"
  machinery** — use Mastra's — and grow into the fully agentic version deliberately.

### D3 — How much do we let Mastra handle vs. build ourselves?

- **Recommendation:**
  - **Let Mastra handle:** the delegation mechanism (one agent calling another),
    memory isolation, and structured results.
  - **We keep owning:** the **Job** as a tracked thing (what was asked, what came back,
    its trace), our **observability**, and **authority** (who's allowed to do dangerous
    things). These are our domain, not Mastra's.
  - **We stop owning:** the custom execution wrapper that sat between us and Mastra —
    that's where the bug was.
- **Changes from before:** Clarifies the boundary. Same framework-first principle,
  applied with the benefit of hindsight.

### D4 — Progress check-ins while we wait

- **Recommendation: keep the idea, change its job.** A check-in should **report status**
  ("still reviewing, 40s in…"), not **redo the work**. The earlier "if it's slow, just
  run it again" idea is dropped — it risked running the review twice (double cost,
  confusing results). Park the heartbeat feature as a nice-to-have, not part of the fix.
- **Changes from before:** Replaces the flawed timeout-retry idea with an observe-only
  heartbeat to consider later.

### D5 — Which tests do we add?

- **Add now (simple, high-value, would have caught this):**
  - A test that a review always finishes and is never left stuck waiting.
  - Tests for the everyday chat commands you actually type (list jobs, view a job, etc.).
  - A basic "does the system start up correctly" check.
- **Hold for later (easy to write badly / prove nothing):**
  - Tests of the full background-queue machinery (only if we revive D1's background path).
  - Tests of the lead "deciding on its own" to delegate (need care or they test the
    mock, not the behavior).
- **Small cleanup first:** make the system a little more test-friendly so the startup
  check can run without touching real files. This pays off elsewhere too.

## What changes from previous decisions — at a glance

| Earlier decision | Status now |
|---|---|
| Run reviews async via background queue (D5) | **Revised** → run now; background deferred + test-gated |
| Delegate via Mastra supervisor/sub-agents (D4) | **Reaffirmed**, leaned on harder |
| Lead auto-decides to delegate (D7) | **Kept as north star**, approached deliberately |
| `review.missing` signal, daemon headlines (D8, D13) | **Unchanged** |
| (new) Timeout that re-runs work | **Rejected** → observe-only heartbeat, later |

## Recommended next steps

1. Make reviews run immediately (the fix), and **update the docs** that currently claim
   background/async so they tell the truth.
2. Add the simple, high-value tests above — test-first: write the "never stuck" test,
   watch it fail, then apply the fix.
3. Do the small test-friendliness cleanup; add the startup check.
4. Leave background execution and fully-agentic delegation as clearly-scoped later work.
