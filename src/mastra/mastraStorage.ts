import { join } from "node:path";
import { LibSQLStore } from "@mastra/libsql";

const STORAGE_ID = "michael-os-storage";

let sharedStorage: LibSQLStore | undefined;

export function createMastraStorage(cwd: string = process.cwd()): LibSQLStore {
  if (sharedStorage) {
    return sharedStorage;
  }
  const dbPath = join(cwd, ".mastra", "mastra.db");
  sharedStorage = new LibSQLStore({
    id: STORAGE_ID,
    url: `file:${dbPath}`,
  });
  return sharedStorage;
}

export function resetMastraStorageForTests(): void {
  sharedStorage = undefined;
}
