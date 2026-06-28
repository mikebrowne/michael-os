import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createConnection, type Socket } from "node:net";
import {
  DEFAULT_GATEWAY_HOST,
  DEFAULT_GATEWAY_PORT,
} from "../src/gateway/daemon.js";

const RECONNECT_DELAY_MS = 2000;

function connectGateway(host: string, port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });
    socket.once("connect", () => resolve(socket));
    socket.once("error", reject);
  });
}

async function main() {
  const host = process.env.GATEWAY_HOST ?? DEFAULT_GATEWAY_HOST;
  const port = Number(process.env.GATEWAY_PORT ?? DEFAULT_GATEWAY_PORT);

  let socket = await connectGateway(host, port);
  let reconnecting = false;

  const attachSocket = (activeSocket: Socket) => {
    activeSocket.on("data", (chunk) => {
      process.stdout.write(chunk.toString("utf-8"));
    });

    activeSocket.on("close", () => {
      if (reconnecting) return;
      reconnecting = true;
      console.error(
        `\nGateway disconnected — reconnecting in ${RECONNECT_DELAY_MS}ms…`,
      );
      setTimeout(async () => {
        try {
          socket = await connectGateway(host, port);
          reconnecting = false;
          attachSocket(socket);
          console.error(`Reconnected to gateway at ${host}:${port}`);
        } catch (error: unknown) {
          reconnecting = false;
          console.error(
            error instanceof Error ? error.message : error,
          );
          process.exit(1);
        }
      }, RECONNECT_DELAY_MS);
    });
  };

  attachSocket(socket);

  const rl = readline.createInterface({ input, output });
  console.log(`Connected to gateway at ${host}:${port}`);

  while (true) {
    const line = await rl.question("you> ");
    if (socket.destroyed) {
      console.error("Waiting for gateway reconnect before sending…");
      await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));
    }
    if (!socket.destroyed) {
      socket.write(`${line}\n`);
    }
    if (["exit", "quit", "q"].includes(line.trim().toLowerCase())) {
      break;
    }
  }

  rl.close();
  socket.end();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
