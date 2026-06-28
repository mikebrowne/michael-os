import type { GhRunner } from "./github.js";
import {
  addIssueLabel,
  addPrLabel,
  closePullRequest,
  convertPrToDraft,
} from "./github.js";
import type { WorkItem } from "./workItem.js";
import { upsertWorkItem } from "./workItem.js";

export type NoRoute = "fix" | "re-spec" | "park" | "abandon";

export function parseNoWithRoute(
  input: string,
): { decision: "no"; route: NoRoute } | null {
  const normalized = input.trim().toLowerCase();
  const routeMatch = normalized.match(
    /^(?:no|n|cancel|stop)(?:\s+(.+))?$/,
  );
  if (!routeMatch) return null;

  const routeToken = routeMatch[1]?.trim();
  if (!routeToken) {
    return { decision: "no", route: "fix" };
  }

  const aliases: Record<string, NoRoute> = {
    fix: "fix",
    "fix-loop": "fix",
    loop: "fix",
    "re-spec": "re-spec",
    respec: "re-spec",
    spec: "re-spec",
    park: "park",
    backlog: "park",
    abandon: "abandon",
    kill: "abandon",
  };

  const route = aliases[routeToken];
  if (!route) return null;
  return { decision: "no", route };
}

export type ApplyNoRouteInput = {
  route: NoRoute;
  workItem: WorkItem;
  stateDir: string;
  githubRepo: string;
  ghRunner: GhRunner;
};

export async function applyNoRoute(
  input: ApplyNoRouteInput,
): Promise<{ message: string; workItem: WorkItem }> {
  const { route, workItem, stateDir, githubRepo, ghRunner } = input;

  if (route === "fix") {
    const saved = upsertWorkItem(stateDir, {
      ...workItem,
      stage: "staged",
    });
    return {
      message:
        "Promotion denied — continuing remediation loop with existing findings.",
      workItem: saved,
    };
  }

  if (route === "re-spec") {
    const saved = upsertWorkItem(stateDir, {
      ...workItem,
      stage: "grill",
    });
    return {
      message:
        "Promotion denied — routed to re-spec. Return to grill/PRD before rebuilding.",
      workItem: saved,
    };
  }

  if (route === "park") {
    if (workItem.stagedPrNumber != null) {
      await convertPrToDraft(ghRunner, githubRepo, workItem.stagedPrNumber);
      await addPrLabel(ghRunner, githubRepo, workItem.stagedPrNumber, "parked");
    }
    if (workItem.issueNumber != null) {
      await addIssueLabel(ghRunner, githubRepo, workItem.issueNumber, "backlog");
    }
    const saved = upsertWorkItem(stateDir, {
      ...workItem,
      stage: "parked",
    });
    return {
      message:
        "Promotion denied — work parked. PR converted to draft with parked label; issue tagged backlog.",
      workItem: saved,
    };
  }

  if (workItem.stagedPrNumber != null) {
    await closePullRequest(ghRunner, githubRepo, workItem.stagedPrNumber);
  }
  const saved = upsertWorkItem(stateDir, {
    ...workItem,
    stage: "abandoned",
  });
  return {
    message: "Promotion denied — PR closed and work item abandoned.",
    workItem: saved,
  };
}
