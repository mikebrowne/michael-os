import { createServer, type Server, type Socket } from "node:net";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, requireOpenAiKey } from "../config/loadConfig.js";
import { ensurePrdsDir } from "../engineering/workItem.js";
import {
  bootstrapGatewayWorkingMemory,
  createGatewayMemorySession,
} from "../engineering/gatewaySession.js";
import {
  createGatewayRuntime,
  processGatewayLine,
  type GatewayRuntime,
} from "./session.js";
import {
  engineeringLeadAgent,
  engineeringSession,
  jobRunner,
  memory,
} from "../mastra/index.js";
import { jobNotificationBus, type JobCompletionEvent } from "../engineering/jobRunner.js";
import {
  emitHarnessBackUp,
  formatRestartLifecycleMessage,
  restartLifecycleBus,
  type RestartLifecycleEvent,
} from "./restart.js";

export const DEFAULT_GATEWAY_HOST = "127.0.0.1";
export const DEFAULT_GATEWAY_PORT = 47821;
const THREAD_STATE_FILE = join(".mastra", "gateway-thread.json");

export type GatewayDaemonOptions = {
  host?: string;
  port?: number;
  repoPath?: string;
};

const connectedSockets = new Set<Socket>();

function resolveHeadCommitSha(repoPath: string): string {
  try {
    return execSync("git rev-parse HEAD", {
      encoding: "utf-8",
      cwd: repoPath,
      stdio: "pipe",
    }).trim();
  } catch {
    return "unknown";
  }
}

function broadcastToClients(message: string): void {
  for (const socket of connectedSockets) {
    if (!socket.destroyed) {
      socket.write(message);
    }
  }
}

function loadOrCreatePersistentThread(repoPath: string): string {
  const statePath = join(repoPath, THREAD_STATE_FILE);
  mkdirSync(join(repoPath, ".mastra"), { recursive: true });
  if (existsSync(statePath)) {
    const parsed = JSON.parse(readFileSync(statePath, "utf-8")) as {
      threadId?: string;
    };
    if (parsed.threadId) return parsed.threadId;
  }
  const session = createGatewayMemorySession();
  writeFileSync(
    statePath,
    `${JSON.stringify({ threadId: session.threadId, resourceId: session.resourceId }, null, 2)}\n`,
    "utf-8",
  );
  return session.threadId;
}

export async function createGatewayDaemonRuntime(
  options: GatewayDaemonOptions = {},
): Promise<{ server: Server; runtime: GatewayRuntime; port: number }> {
  const repoPath = options.repoPath ?? process.cwd();
  const config = loadConfig(repoPath);
  requireOpenAiKey(config);
  ensurePrdsDir(config.prdsDir);

  const ctx = engineeringSession;
  const agent = engineeringLeadAgent;
  const threadId = loadOrCreatePersistentThread(repoPath);
  const memorySession = {
    threadId,
    resourceId: "operator" as const,
  };

  await bootstrapGatewayWorkingMemory(memory, memorySession, ctx.currentWorkItem);

  const runtime = await createGatewayRuntime({
    config,
    ctx,
    agent,
    memory,
    memorySession,
  });

  const port = options.port ?? DEFAULT_GATEWAY_PORT;
  const host = options.host ?? DEFAULT_GATEWAY_HOST;

  jobNotificationBus.on("job.completed", (event: JobCompletionEvent) => {
    broadcastToClients(`\n${event.headline}\n`);
  });

  restartLifecycleBus.on("lifecycle", (event: RestartLifecycleEvent) => {
    broadcastToClients(`\n${formatRestartLifecycleMessage(event)}\n`);
  });

  emitHarnessBackUp(resolveHeadCommitSha(repoPath));

  const server = createServer((socket: Socket) => {
    connectedSockets.add(socket);
    let buffer = "";
    socket.write("MichaelOS Engineering Gateway (daemon)\n");
    socket.write("Commands: exit | resume #N | list | jobs | job <id> | health | promotions | restart\n\n");

    socket.on("close", () => {
      connectedSockets.delete(socket);
    });

    socket.on("data", async (chunk) => {
      buffer += chunk.toString("utf-8");
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        try {
          const result = await processGatewayLine(runtime, line);
          for (const part of result.output) {
            socket.write(part);
          }
          if (result.exit) {
            socket.end();
          }
        } catch (error: unknown) {
          socket.write(
            `Error: ${error instanceof Error ? error.message : error}\n`,
          );
        }
        newlineIndex = buffer.indexOf("\n");
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });

  void jobRunner;

  return { server, runtime, port };
}

export async function startGatewayDaemon(
  options: GatewayDaemonOptions = {},
): Promise<Server> {
  const { server, port } = await createGatewayDaemonRuntime(options);
  console.log(`Gateway daemon listening on ${DEFAULT_GATEWAY_HOST}:${port}`);
  return server;
}
