import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  configureCursorSdk,
  JsonlLocalAgentStore,
} from "@cursor/sdk";

let configuredRoot: string | undefined;

/**
 * Point the Cursor SDK local agent store at gitignored `.mastra/cursor-sdk/`.
 * Idempotent per root path.
 */
export function configureCursorSdkStore(mastraDir: string): void {
  const stateRoot = join(mastraDir, "cursor-sdk");
  if (configuredRoot === stateRoot) {
    return;
  }
  mkdirSync(stateRoot, { recursive: true });
  const store = new JsonlLocalAgentStore(stateRoot);
  configureCursorSdk({ local: { store } });
  configuredRoot = stateRoot;
}

/** Test-only: reset module-level configure guard. */
export function resetCursorSdkStoreForTests(): void {
  configuredRoot = undefined;
}
