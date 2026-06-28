import { DANGEROUS_TOOL_IDS } from "./approvalGate.js";

export type PermissionScanFinding = {
  rule: string;
  file: string;
  line?: number;
  message: string;
};

const SECURITY_RAILS_PATTERNS = [
  /^\.github\/workflows\//,
  /^\.gitignore$/,
  /gitleaks/i,
  /^\.env\.example$/,
  /^AGENTS\.md$/,
  /^\.cursor\/rules\//,
];

const SHELL_PATTERNS = [
  /\bexecSync\s*\(/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/,
  /\bchild_process\b/,
];

const DELETE_PATTERNS = [
  /\bunlinkSync\s*\(/,
  /\brmSync\s*\(/,
  /\bunlink\s*\(/,
  /\bfs\.rm\s*\(/,
];

const NETWORK_PATTERNS = [
  /\bfetch\s*\(/,
  /\baxios\b/,
  /\bhttp\.request\s*\(/,
  /\bhttps\.request\s*\(/,
];

const MESSAGE_PATTERNS = [
  /\bwebhook\b/i,
  /\bsendEmail\b/i,
  /\bpostMessage\b/i,
];

function parseDiffFiles(diff: string): Array<{ file: string; hunks: string }> {
  const files: Array<{ file: string; hunks: string }> = [];
  const parts = diff.split(/^diff --git /m).filter(Boolean);
  for (const part of parts) {
    const fileMatch = part.match(/a\/(.+?) b\//);
    const file = fileMatch?.[1];
    if (!file) continue;
    files.push({ file, hunks: part });
  }
  return files;
}

function hunkAddsLines(hunks: string): string[] {
  return hunks
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));
}

export function scanPermissionDiff(diff: string): PermissionScanFinding[] {
  const findings: PermissionScanFinding[] = [];
  const files = parseDiffFiles(diff);

  for (const { file, hunks } of files) {
    const added = hunkAddsLines(hunks).join("\n");

    for (const toolId of DANGEROUS_TOOL_IDS) {
      if (added.includes(`"${toolId}"`) || added.includes(`'${toolId}'`)) {
        findings.push({
          rule: "dangerous-tool",
          file,
          message: `Adds or edits dangerous tool: ${toolId}`,
        });
      }
    }

    if (
      added.includes('authority: "management"') ||
      added.includes("authority: 'management'") ||
      /employee.*management/.test(added)
    ) {
      findings.push({
        rule: "authority-escalation",
        file,
        message: "Possible authority escalation to management",
      });
    }

    if (file === "package.json" || file.endsWith("package-lock.json")) {
      findings.push({
        rule: "dependency-change",
        file,
        message: "Dependency or lockfile change requires acknowledgement",
      });
    }

    for (const pattern of SECURITY_RAILS_PATTERNS) {
      if (pattern.test(file)) {
        findings.push({
          rule: "security-rails",
          file,
          message: `Touches security/CI rails: ${file}`,
        });
        break;
      }
    }

    const patternChecks: Array<[string, RegExp[]]> = [
      ["shell-exec", SHELL_PATTERNS],
      ["file-deletion", DELETE_PATTERNS],
      ["network-external-write", NETWORK_PATTERNS],
      ["message-sending", MESSAGE_PATTERNS],
    ];

    for (const [rule, patterns] of patternChecks) {
      if (patterns.some((p) => p.test(added))) {
        findings.push({
          rule,
          file,
          message: `Introduces ${rule.replace("-", " ")} pattern`,
        });
      }
    }

    if (
      file.includes("agentRegistry") &&
      (added.includes("tools:") || added.includes("id:"))
    ) {
      findings.push({
        rule: "new-tool-registration",
        file,
        message: "Registers or edits agent tools in agentRegistry",
      });
    }
  }

  return findings;
}

export function permissionScanPasses(diff: string): boolean {
  return scanPermissionDiff(diff).length === 0;
}
