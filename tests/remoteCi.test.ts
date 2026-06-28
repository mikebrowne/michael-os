import { describe, expect, it } from "vitest";
import { runRemoteCiGate } from "../src/engineering/buildVerificationRunner.js";
import type { GhRunner } from "../src/engineering/github.js";

describe("remote CI gate", () => {
  it("blocks when remote checks are red", async () => {
    const ghRunner: GhRunner = async () => ({
      stdout: JSON.stringify([
        { name: "ci", state: "FAILURE", conclusion: "FAILURE" },
      ]),
      stderr: "",
      exitCode: 0,
    });

    const gate = await runRemoteCiGate({
      worktreePath: ".",
      codeReviewInput: {
        gitDiff: "",
        prdMarkdown: "",
        acceptanceTest: "",
        changedFiles: [],
      },
      prNumber: 1,
      githubRepo: "test/repo",
      ghRunner,
    });

    expect(gate.kind).toBe("remote-ci");
    expect(gate.status).toBe("fail");
  });

  it("passes when remote checks are green", async () => {
    const ghRunner: GhRunner = async () => ({
      stdout: JSON.stringify([
        { name: "ci", state: "SUCCESS", conclusion: "SUCCESS" },
      ]),
      stderr: "",
      exitCode: 0,
    });

    const gate = await runRemoteCiGate({
      worktreePath: ".",
      codeReviewInput: {
        gitDiff: "",
        prdMarkdown: "",
        acceptanceTest: "",
        changedFiles: [],
      },
      prNumber: 1,
      githubRepo: "test/repo",
      ghRunner,
    });

    expect(gate.status).toBe("pass");
  });

  it("allows override of red remote CI", async () => {
    const ghRunner: GhRunner = async () => ({
      stdout: JSON.stringify([
        { name: "ci", state: "FAILURE", conclusion: "FAILURE" },
      ]),
      stderr: "",
      exitCode: 0,
    });

    const gate = await runRemoteCiGate({
      worktreePath: ".",
      codeReviewInput: {
        gitDiff: "",
        prdMarkdown: "",
        acceptanceTest: "",
        changedFiles: [],
      },
      prNumber: 1,
      githubRepo: "test/repo",
      ghRunner,
      remoteCiOverride: true,
    });

    expect(gate.status).toBe("pass");
    expect(gate.overridden).toBe(true);
  });
});
