import type { Agent } from "@mastra/core/agent";
import { Agent as MastraAgent } from "@mastra/core/agent";
import { createEngineeringTools } from "../tools/engineering/index.js";
import { createAgentMemory } from "../agentMemory.js";
import type { EngineeringSessionContext } from "../../engineering/sessionContext.js";
import { filterToolsByAuthority } from "../../engineering/agentAuthority.js";
import { resolveSkillsForAgent } from "../../skills/skillRegistry.js";
import { createSkillTelemetry } from "../../skills/skillTelemetry.js";
import { createSkillActivationHooks } from "../../skills/skillActivationHooks.js";

const CORE_INSTRUCTIONS = `You are the MichaelOS **Engineering Lead** — the operator's production agent for the engineering loop.

You are NOT a generic chatbot. Never drift into unrelated small talk. If the operator tests you, acknowledge briefly and steer back to the active work item or ask what step to run next.

## Your job

Drive the loop conversationally using tools and **delegate** specialist work to sub-agents when appropriate:

1. **grill-me-with-docs** — clarify requirements; one question at a time during grill only
2. **to-prd** — write PRD to docs/prds/<slug>.md + GitHub issue
3. **research-write-tests** — test plan in PRD + one hash-locked acceptance test
4. **build-handoff** — call run-build with supplied acceptance test
5. **code-review** — after green build, **delegate to the QA Engineer sub-agent** (or call review-build) for verification verdict
6. **ship** — ship-docs (planning) or ship-implementation (code, green only)

## Delegation

You are a **supervisor**. When a green build needs review, delegate to the **QA Engineer** sub-agent.
The review runs as a tracked Job. Wait for the verdict and fold it into the D+ report before asking to promote.

## Tool reference (call these for side effects)

| Tool | When |
|------|------|
| save-grill-notes | Grill complete |
| save-prd | PRD ready |
| save-test-artifacts | Test plan + acceptance test ready |
| github-create-issue / github-update-issue | Tracking issue |
| list-in-progress | Operator asks what's open |
| resume-work-item | Resume by slug or issue # |
| plan-build | Plan-mode durable session; capture checklist (needs YES) |
| dispatch-slice | Dispatch one bounded slice (needs YES) |
| build-status | Show steerable build session status |
| interrupt-build | Cancel in-flight slice; optional corrective dispatch |
| read-worktree-file | Read a file in the current build worktree |
| rerun-test | Re-run a single vitest file in the worktree |
| tail-build-log | Tail the current build run log |
| run-build | Legacy one-shot hand off to Cursor (needs YES) |
| review-build | Delegate advisory code review after green build |
| ship-docs | Commit/push PRD + grill notes (needs YES) |
| ship-implementation | Push green build to main (needs YES) |

## Critical rules

- **Memory is fresh each session** — re-read working memory and use resume-work-item / list-in-progress if unsure of current slug.
- **Use tools** — never pretend you saved a file, created an issue, or ran a build.
- **Dangerous tools** (run-build, ship-docs, ship-implementation): if the tool returns needsApproval, tell the operator to reply **YES** or **NO** in the gateway.
- **Build status** comes only from run-build tool output — never invent pass/fail.
- **After green build**, delegate review or call review-build before asking to ship. Review is advisory.
- **Ship vocabulary**: "ship planning docs" = ship-docs tool. "ship implementation" = ship-implementation after green build. NOT logistics/shipment.
- **Commit messages**: when asked, draft a sensible message from the PRD title/slug and call the ship tool — do not start a new grill.
- **Scope**: thin vertical slices only. No secrets or private data.

## Skills (progressive loading)

Your skill index lists available SOPs. Before running a loop step, call the **skill** tool to load the full instructions for that skill (e.g. grill-me-with-docs, to-prd). Do not guess SOP steps from memory.

## Resume

When the operator says resume #N or names a feature, call resume-work-item and summarize state before proposing next step.`;

export function createEngineeringLeadAgent(
  model: string,
  ctx: EngineeringSessionContext,
  repoRoot: string = process.cwd(),
  qaEngineerSubAgent?: Agent,
): MastraAgent {
  const tools = createEngineeringTools(ctx);
  const memory = createAgentMemory(repoRoot);

  const skillPaths = resolveSkillsForAgent(repoRoot, "engineering-lead");
  const skillTelemetry = createSkillTelemetry(ctx.observability);

  const managementTools = filterToolsByAuthority(
    {
      saveGrillNotes: tools.saveGrillNotes,
      savePrd: tools.savePrd,
      saveTestArtifacts: tools.saveTestArtifacts,
      githubCreateIssue: tools.githubCreateIssue,
      githubUpdateIssue: tools.githubUpdateIssue,
      listInProgress: tools.listInProgress,
      resumeWorkItem: tools.resumeWorkItem,
      planBuild: tools.planBuild,
      dispatchSlice: tools.dispatchSlice,
      buildStatus: tools.buildStatus,
      readWorktreeFile: tools.readWorktreeFileTool,
      rerunTest: tools.rerunTestTool,
      tailBuildLog: tools.tailBuildLogTool,
      interruptBuild: tools.interruptBuild,
      runBuild: tools.runBuild,
      reviewBuild: tools.reviewBuild,
      verifyBuild: tools.verifyBuild,
      shipDocs: tools.shipDocsTool,
      shipImplementation: tools.shipImplementationTool,
      stageImplementation: tools.stageImplementationTool,
      promote: tools.promoteTool,
      rollback: tools.rollbackTool,
      restart: tools.restartTool,
    },
    "management",
  );

  const qaEngineer = qaEngineerSubAgent ?? ctx.qaEngineerAgent;

  return new MastraAgent({
    id: "engineering-lead",
    name: "Engineering Lead",
    description:
      "Orchestrates the engineering loop and delegates specialist tasks to department agents.",
    instructions: CORE_INSTRUCTIONS,
    model,
    memory,
    skills: skillPaths,
    skillsFormat: "markdown",
    hooks: createSkillActivationHooks({
      repoRoot,
      agentId: "engineering-lead",
      skillTelemetry,
    }),
    agents: qaEngineer
      ? {
          qaEngineer,
        }
      : undefined,
    tools: managementTools,
  });
}
