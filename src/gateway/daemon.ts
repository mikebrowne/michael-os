import { createServer, type Server, type Socket } from "node:net";
import { execSync } from "node:child_process";
import { loadConfig, requireOpenAiKey } from "../config/loadConfig.js";
import { ensurePrdsDir } from "../engineering/workItem.js";
import { bootstrapGatewayWorkingMemory } from "../engineering/gatewaySession.js";
import {
  createGatewayRuntime,
  gatewayPromptLabel,
  processGatewayLine,
  type GatewayRuntime,
} from "./session.js";
import {
  buildGatewayAgentsMap,
  initGatewayRouteState,
} from "./gatewayAgents.js";
import { getThreadIdForRoute } from "./gatewayRouteRegistry.js";
import {
  engineeringLeadAgent,
  engagementManagerAgent,
  engineeringSession,
  jobRunner,
  memory,
  skillEngineerAgent,
} from "../mastra/index.js";
import { jobNotificationBus, type JobCompletionEvent } from "../engineering/jobRunner.js";
import {
  emitHarnessBackUp,
  formatRestartLifecycleMessage,
  restartLifecycleBus,
  type RestartLifecycleEvent,
} from "./restart.js";
import {
  buildStreamBus,
  formatBuildStreamMessage,
} from "../agentBuild/buildStreamBus.js";

export const DEFAULT_GATEWAY_HOST = "127.0.0.1";
export const DEFAULT_GATEWAY_PORT = 47821;

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

export async function createGatewayDaemonRuntime(
  options: GatewayDaemonOptions = {},
): Promise<{ server: Server; runtime: GatewayRuntime; port: number }> {
  const repoPath = options.repoPath ?? process.cwd();
  const config = loadConfig(repoPath);
  requireOpenAiKey(config);
  ensurePrdsDir(config.prdsDir);

  const ctx = engineeringSession;
  const routeState = initGatewayRouteState(repoPath, true);
  const agents = buildGatewayAgentsMap({
    engineeringLeadAgent,
    skillEngineerAgent,
    engagementManagerAgent,
    repoPath,
  });

  const memorySession = {
    threadId: getThreadIdForRoute(routeState, routeState.activeAgentId),
    resourceId: routeState.resourceId,
  };

  await bootstrapGatewayWorkingMemory(memory, memorySession, ctx.currentWorkItem);

  const runtime = await createGatewayRuntime({
    config,
    ctx,
    agents,
    routeState,
    memory,
    repoPath,
    persistRoutes: true,
  });

  const port = options.port ?? DEFAULT_GATEWAY_PORT;
  const host = options.host ?? DEFAULT_GATEWAY_HOST;

  jobNotificationBus.on("job.completed", (event: JobCompletionEvent) => {
    broadcastToClients(`\n${event.headline}\n`);
  });

  restartLifecycleBus.on("lifecycle", (event: RestartLifecycleEvent) => {
    broadcastToClients(`\n${formatRestartLifecycleMessage(event)}\n`);
  });

  buildStreamBus.onStream((event) => {
    broadcastToClients(`\n${formatBuildStreamMessage(event)}\n`);
  });

  emitHarnessBackUp(resolveHeadCommitSha(repoPath));

  const server = createServer((socket: Socket) => {
    connectedSockets.add(socket);
    let buffer = "";
    socket.write("MichaelOS Engineering Gateway (daemon)\n");
    socket.write(
      "Commands: @<agent-id> | agents | verdict | exit | resume #N | list | jobs | job <id> | builds | build <id> | stop | cancel | health | promotions | restart\n\n",
    );
    socket.write(`Active route: ${gatewayPromptLabel(runtime)}\n\n`);

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
