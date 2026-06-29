import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import type { AppConfig } from "../config/loadConfig.js";
import type { ObservabilityStore } from "../observability/observabilityStore.js";
import { createDurableCursorExecutor } from "./durableCodingExecutor.js";
import { createWorktree, removeWorktree } from "./worktree.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

export type ComprehensionCitation = {
  path: string;
  symbol?: string;
};

export type CitationVerifyResult = {
  citation: ComprehensionCitation;
  ok: boolean;
  reason?: string;
};

export type ComprehensionResult = {
  answer: string;
  citations: ComprehensionCitation[];
  verification: CitationVerifyResult[];
  allCitationsVerified: boolean;
};

const COMPREHENSION_PROMPT_PREFIX =
  "Do not write any code. Answer using codebase reasoning only. Cite file paths in backticks and name symbols you reference.";

/** Extract `path/file.ts` citations and optional Symbol: lines from comprehension output. */
export function extractCitations(text: string): ComprehensionCitation[] {
  const citations: ComprehensionCitation[] = [];
  const seen = new Set<string>();

  const pathRegex = /`([^\s`]+\.(?:ts|tsx|js|jsx|md|json))`/g;
  let match: RegExpExecArray | null;
  while ((match = pathRegex.exec(text)) !== null) {
    const path = match[1]!;
    const key = path;
    if (!seen.has(key)) {
      seen.add(key);
      citations.push({ path });
    }
  }

  const symbolLineRegex = /(?:symbol|function|class|type)\s+[`']?([A-Za-z_$][\w$]*)[`']?/gi;
  while ((match = symbolLineRegex.exec(text)) !== null) {
    const symbol = match[1];
    if (!symbol) continue;
    const pathBefore = citations[citations.length - 1];
    if (pathBefore && !pathBefore.symbol) {
      pathBefore.symbol = symbol;
    }
  }

  return citations;
}

export function verifyCitation(
  repoRoot: string,
  citation: ComprehensionCitation,
): CitationVerifyResult {
  const abs = join(repoRoot, citation.path);
  if (!existsSync(abs)) {
    return {
      citation,
      ok: false,
      reason: "path not found",
    };
  }

  if (!citation.symbol) {
    return { citation, ok: true };
  }

  try {
    const content = readFileSync(abs, "utf-8");
    const pattern = new RegExp(
      `(export\\s+)?(function|class|type|interface|const)\\s+${citation.symbol}\\b`,
    );
    if (pattern.test(content)) {
      return { citation, ok: true };
    }
    const grep = execSync(
      `rg -n ${JSON.stringify(citation.symbol)} ${JSON.stringify(citation.path)}`,
      { cwd: repoRoot, encoding: "utf-8", stdio: "pipe" },
    );
    if (grep.trim().length > 0) {
      return { citation, ok: true };
    }
    return { citation, ok: false, reason: `symbol ${citation.symbol} not found` };
  } catch {
    return { citation, ok: false, reason: `symbol ${citation.symbol} not found` };
  }
}

export async function runComprehension(options: {
  config: AppConfig;
  repoPath: string;
  question: string;
  observability: ObservabilityStore;
}): Promise<ComprehensionResult> {
  const { config, repoPath, question, observability } = options;
  observability.emit(
    "comprehension.invoked",
    {},
    { questionLength: question.length },
    "standard",
  );

  const tempParent = mkdtempSync(join(tmpdir(), "michael-os-comprehend-"));
  const worktreePath = join(tempParent, "wt");
  let worktreeInfo: ReturnType<typeof createWorktree> | undefined;

  try {
    worktreeInfo = createWorktree(repoPath, worktreePath, "comprehend");
    const executor = createDurableCursorExecutor(config);
    const started = await executor.startSession({
      worktreePath,
      runDir: join(tempParent, "run"),
      initialMode: "plan",
    });

    if (!started.ok) {
      throw new Error(started.error);
    }

    const { session } = started;
    try {
      const run = await session.send({
        message: `${COMPREHENSION_PROMPT_PREFIX}\n\n${question}`,
        mode: "plan",
      });
      const result = await run.wait();
      const answer =
        typeof result.result === "string"
          ? result.result
          : "No comprehension answer returned.";

      const citations = extractCitations(answer);
      const verification = citations.map((c) => verifyCitation(repoPath, c));

      for (const v of verification) {
        observability.emit(
          v.ok ? "comprehension.cite_verified" : "comprehension.cite_failed",
          {},
          { path: v.citation.path, symbol: v.citation.symbol, reason: v.reason },
          "minimal",
        );
      }

      return {
        answer,
        citations,
        verification,
        allCitationsVerified: verification.every((v) => v.ok),
      };
    } finally {
      session.close();
    }
  } finally {
    if (worktreeInfo) {
      removeWorktree(repoPath, worktreeInfo);
    }
    rmSync(tempParent, { recursive: true, force: true });
  }
}
