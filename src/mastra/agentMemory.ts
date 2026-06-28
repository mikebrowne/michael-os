import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { Memory } from "@mastra/memory";
import type { LibSQLStore } from "@mastra/libsql";
import { createMastraStorage } from "./mastraStorage.js";

let sharedMemory: Memory | undefined;

export function createAgentMemory(
  cwd: string = process.cwd(),
  storage?: LibSQLStore,
): Memory {
  if (sharedMemory) {
    return sharedMemory;
  }

  mkdirSync(join(cwd, ".mastra"), { recursive: true });
  const store = storage ?? createMastraStorage(cwd);

  sharedMemory = new Memory({
    storage: store,
    options: {
      lastMessages: 40,
      workingMemory: {
        enabled: true,
        scope: "thread",
      },
    },
  });

  return sharedMemory;
}

export function resetAgentMemoryForTests(): void {
  sharedMemory = undefined;
}
