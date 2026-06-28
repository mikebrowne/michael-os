import { z } from "zod";

export const GATE_KINDS = ["ci", "permission-scan", "code-review", "security-review", "remote-ci"] as const;
export type GateKind = (typeof GATE_KINDS)[number];

export const gateFindingSchema = z.object({
  severity: z.enum(["info", "warning", "critical"]),
  file: z.string().optional(),
  line: z.string().optional(),
  message: z.string(),
  category: z.enum(["code", "security", "permission", "spec", "ci"]).optional(),
});

export type GateFinding = z.infer<typeof gateFindingSchema>;

export const gateResultSchema = z.object({
  kind: z.enum(GATE_KINDS),
  status: z.enum(["pass", "fail"]),
  findings: z.array(gateFindingSchema),
  overridden: z.boolean().optional(),
});

export type GateResult = z.infer<typeof gateResultSchema>;

export const buildVerificationVerdictSchema = z.object({
  gates: z.array(gateResultSchema),
  overall: z.enum(["pass", "fail"]),
});

export type BuildVerificationVerdict = z.infer<typeof buildVerificationVerdictSchema>;

export function aggregateGateResults(gates: GateResult[]): BuildVerificationVerdict {
  const overall = gates.every((g) => g.status === "pass" || g.overridden) ? "pass" : "fail";
  return { gates, overall };
}

export function canPromoteWithVerdict(
  verdict: BuildVerificationVerdict,
  overrides: Partial<Record<GateKind, boolean>> = {},
): boolean {
  return verdict.gates.every((gate) => {
    if (gate.status === "pass") return true;
    return overrides[gate.kind] === true;
  });
}

export function formatBuildVerificationReport(verdict: BuildVerificationVerdict): string {
  const lines = [
    `Build verification: **${verdict.overall.toUpperCase()}**`,
    "",
    "Gates:",
  ];
  for (const gate of verdict.gates) {
    const override = gate.overridden ? " (overridden)" : "";
    lines.push(`- ${gate.kind}: ${gate.status}${override}`);
    for (const f of gate.findings) {
      lines.push(`  - [${f.severity}] ${f.message}`);
    }
  }
  return lines.join("\n");
}

export function assertAllGatesPresent(
  verdict: BuildVerificationVerdict,
  required: GateKind[],
): void {
  const present = new Set(verdict.gates.map((g) => g.kind));
  for (const kind of required) {
    if (!present.has(kind)) {
      throw new Error(`Gate cannot be skipped: missing ${kind}`);
    }
  }
}

export const REQUIRED_SLICE2_GATES: GateKind[] = ["ci", "code-review"];
