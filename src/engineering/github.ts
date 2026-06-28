export type GhRunner = (args: string[]) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

export type CreateIssueInput = {
  title: string;
  body: string;
  labels?: string[];
  milestone?: string;
};

export function buildCreateIssueCommand(
  repo: string,
  input: CreateIssueInput,
): string[] {
  const args = [
    "issue",
    "create",
    "--repo",
    repo,
    "--title",
    input.title,
    "--body",
    input.body,
  ];
  if (input.labels?.length) {
    args.push("--label", input.labels.join(","));
  }
  if (input.milestone) {
    args.push("--milestone", input.milestone);
  }
  return ["gh", ...args];
}

export function buildUpdateIssueCommand(
  repo: string,
  issueNumber: number,
  body: string,
): string[] {
  return [
    "gh",
    "issue",
    "edit",
    String(issueNumber),
    "--repo",
    repo,
    "--body",
    body,
  ];
}

export function buildViewIssueCommand(repo: string, issueNumber: number): string[] {
  return ["gh", "issue", "view", String(issueNumber), "--repo", repo, "--json", "title,body,number,state"];
}

export function parseIssueNumberFromCreateOutput(stdout: string): number | undefined {
  const match = stdout.match(/issues\/(\d+)/);
  return match ? Number(match[1]) : undefined;
}

export function parsePrNumberFromCreateOutput(stdout: string): number | undefined {
  const match = stdout.match(/pull\/(\d+)/);
  return match ? Number(match[1]) : undefined;
}

export type CreatePrInput = {
  title: string;
  body: string;
  head: string;
  base?: string;
  draft?: boolean;
};

export function buildCreatePrCommand(repo: string, input: CreatePrInput): string[] {
  const args = [
    "pr",
    "create",
    "--repo",
    repo,
    "--title",
    input.title,
    "--body",
    input.body,
    "--head",
    input.head,
    "--base",
    input.base ?? "main",
  ];
  if (input.draft) {
    args.push("--draft");
  }
  return ["gh", ...args];
}

export function buildMergePrCommand(
  repo: string,
  prNumber: number,
): string[] {
  return ["gh", "pr", "merge", String(prNumber), "--repo", repo, "--merge"];
}

export function buildPrChecksCommand(repo: string, prNumber: number): string[] {
  return [
    "gh",
    "pr",
    "checks",
    String(prNumber),
    "--repo",
    repo,
    "--json",
    "name,state,conclusion",
  ];
}

export function buildConvertPrToDraftCommand(
  repo: string,
  prNumber: number,
): string[] {
  return ["gh", "pr", "ready", String(prNumber), "--repo", repo, "--undo"];
}

export function buildAddPrLabelCommand(
  repo: string,
  prNumber: number,
  label: string,
): string[] {
  return [
    "gh",
    "pr",
    "edit",
    String(prNumber),
    "--repo",
    repo,
    "--add-label",
    label,
  ];
}

export function buildClosePrCommand(repo: string, prNumber: number): string[] {
  return ["gh", "pr", "close", String(prNumber), "--repo", repo];
}

export function buildAddIssueLabelCommand(
  repo: string,
  issueNumber: number,
  label: string,
): string[] {
  return [
    "gh",
    "issue",
    "edit",
    String(issueNumber),
    "--repo",
    repo,
    "--add-label",
    label,
  ];
}

export async function createPullRequest(
  runner: GhRunner,
  repo: string,
  input: CreatePrInput,
): Promise<{ prNumber?: number; stdout: string }> {
  const cmd = buildCreatePrCommand(repo, input);
  const result = await runner(cmd.slice(1));
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || "gh pr create failed");
  }
  return {
    prNumber: parsePrNumberFromCreateOutput(result.stdout),
    stdout: result.stdout,
  };
}

export async function mergePullRequest(
  runner: GhRunner,
  repo: string,
  prNumber: number,
): Promise<void> {
  const cmd = buildMergePrCommand(repo, prNumber);
  const result = await runner(cmd.slice(1));
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || "gh pr merge failed");
  }
}

export type PrCheckStatus = {
  name: string;
  state: string;
  conclusion?: string;
};

export async function getPrChecks(
  runner: GhRunner,
  repo: string,
  prNumber: number,
): Promise<PrCheckStatus[]> {
  const cmd = buildPrChecksCommand(repo, prNumber);
  const result = await runner(cmd.slice(1));
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || "gh pr checks failed");
  }
  return JSON.parse(result.stdout) as PrCheckStatus[];
}

export async function convertPrToDraft(
  runner: GhRunner,
  repo: string,
  prNumber: number,
): Promise<void> {
  const cmd = buildConvertPrToDraftCommand(repo, prNumber);
  const result = await runner(cmd.slice(1));
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || "gh pr ready --undo failed");
  }
}

export async function addPrLabel(
  runner: GhRunner,
  repo: string,
  prNumber: number,
  label: string,
): Promise<void> {
  const cmd = buildAddPrLabelCommand(repo, prNumber, label);
  const result = await runner(cmd.slice(1));
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || "gh pr edit --add-label failed");
  }
}

export async function closePullRequest(
  runner: GhRunner,
  repo: string,
  prNumber: number,
): Promise<void> {
  const cmd = buildClosePrCommand(repo, prNumber);
  const result = await runner(cmd.slice(1));
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || "gh pr close failed");
  }
}

export async function addIssueLabel(
  runner: GhRunner,
  repo: string,
  issueNumber: number,
  label: string,
): Promise<void> {
  const cmd = buildAddIssueLabelCommand(repo, issueNumber, label);
  const result = await runner(cmd.slice(1));
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || "gh issue edit --add-label failed");
  }
}

export async function createIssue(
  runner: GhRunner,
  repo: string,
  input: CreateIssueInput,
): Promise<{ issueNumber?: number; stdout: string }> {
  const cmd = buildCreateIssueCommand(repo, input);
  const result = await runner(cmd.slice(1));
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || "gh issue create failed");
  }
  return {
    issueNumber: parseIssueNumberFromCreateOutput(result.stdout),
    stdout: result.stdout,
  };
}

export async function updateIssueBody(
  runner: GhRunner,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<void> {
  const cmd = buildUpdateIssueCommand(repo, issueNumber, body);
  const result = await runner(cmd.slice(1));
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || "gh issue edit failed");
  }
}

export async function viewIssue(
  runner: GhRunner,
  repo: string,
  issueNumber: number,
): Promise<{ title: string; body: string; number: number; state: string }> {
  const cmd = buildViewIssueCommand(repo, issueNumber);
  const result = await runner(cmd.slice(1));
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || "gh issue view failed");
  }
  const parsed = JSON.parse(result.stdout) as {
    title: string;
    body: string;
    number: number;
    state: string;
  };
  return parsed;
}
