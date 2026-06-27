import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";

const MEMORY_STORE_ID = "michael-os-memory";
const MEMORY_DB_RELATIVE = join(".mastra", "memory.db");

let sharedMemory: Memory | undefined;

export function createAgentMemory(cwd: string = process.cwd()): Memory {
  if (sharedMemory) {
    return sharedMemory;
  }

  mkdirSync(join(cwd, ".mastra"), { recursive: true });
  const storage = new LibSQLStore({
    id: MEMORY_STORE_ID,
    url: `file:${MEMORY_DB_RELATIVE}`,
  });

  sharedMemory = new Memory({
    storage,
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
