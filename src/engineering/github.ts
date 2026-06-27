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
