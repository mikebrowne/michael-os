import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { slugifyRequest } from "../agentBuild/runDir.js";

export type WorkItemStage =
  | "grill"
  | "prd"
  | "tests"
  | "build"
  | "ship"
  | "done"
  | "abandoned";

export type WorkItem = {
  id: string;
  slug: string;
  title: string;
  stage: WorkItemStage;
  issueNumber?: number;
  grillNotesPath?: string;
  prdPath?: string;
  acceptanceTestPath?: string;
  lastRunDir?: string;
  lastBuildSuccess?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WorkItemStore = {
  items: WorkItem[];
};

export function prdPaths(prdsDir: string, slug: string) {
  return {
    grillNotesPath: join(prdsDir, `${slug}.grill.md`),
    prdPath: join(prdsDir, `${slug}.md`),
    acceptanceTestPath: join(prdsDir, `${slug}.acceptance.test.ts`),
  };
}

export function createWorkItem(title: string, now: Date = new Date()): WorkItem {
  const slug = slugifyRequest(title);
  const timestamp = now.toISOString();
  return {
    id: slug,
    slug,
    title: title.trim(),
    stage: "grill",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function workItemStorePath(stateDir: string): string {
  return join(stateDir, "work-items.json");
}

export function loadWorkItemStore(stateDir: string): WorkItemStore {
  const path = workItemStorePath(stateDir);
  if (!existsSync(path)) {
    return { items: [] };
  }
  return JSON.parse(readFileSync(path, "utf-8")) as WorkItemStore;
}

export function saveWorkItemStore(stateDir: string, store: WorkItemStore): void {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(workItemStorePath(stateDir), `${JSON.stringify(store, null, 2)}\n`, "utf-8");
}

export function upsertWorkItem(stateDir: string, item: WorkItem): WorkItem {
  const store = loadWorkItemStore(stateDir);
  const index = store.items.findIndex((i) => i.slug === item.slug);
  const updated = { ...item, updatedAt: new Date().toISOString() };
  if (index >= 0) {
    store.items[index] = updated;
  } else {
    store.items.push(updated);
  }
  saveWorkItemStore(stateDir, store);
  return updated;
}

export function getWorkItem(stateDir: string, slug: string): WorkItem | undefined {
  return loadWorkItemStore(stateDir).items.find((i) => i.slug === slug);
}

export function getWorkItemByIssue(
  stateDir: string,
  issueNumber: number,
): WorkItem | undefined {
  return loadWorkItemStore(stateDir).items.find((i) => i.issueNumber === issueNumber);
}

export function listInProgressWorkItems(stateDir: string): WorkItem[] {
  return loadWorkItemStore(stateDir).items.filter(
    (i) => i.stage !== "done" && i.stage !== "abandoned",
  );
}

export function findWorkItemByName(stateDir: string, query: string): WorkItem[] {
  const q = query.toLowerCase();
  return loadWorkItemStore(stateDir).items.filter(
    (i) =>
      i.title.toLowerCase().includes(q) ||
      i.slug.includes(q.replace(/[^a-z0-9]+/g, "-")),
  );
}

export function ensurePrdsDir(prdsDir: string): void {
  mkdirSync(prdsDir, { recursive: true });
}

export function listPrdSlugs(prdsDir: string): string[] {
  if (!existsSync(prdsDir)) return [];
  return readdirSync(prdsDir)
    .filter((f) => f.endsWith(".md") && !f.endsWith(".grill.md"))
    .map((f) => f.replace(/\.md$/, ""));
}
