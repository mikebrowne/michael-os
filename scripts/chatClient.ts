import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createConnection } from "node:net";
import {
  DEFAULT_GATEWAY_HOST,
  DEFAULT_GATEWAY_PORT,
} from "../src/gateway/daemon.js";

async function main() {
  const host = process.env.GATEWAY_HOST ?? DEFAULT_GATEWAY_HOST;
  const port = Number(process.env.GATEWAY_PORT ?? DEFAULT_GATEWAY_PORT);

  const socket = createConnection({ host, port });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("error", reject);
  });

  socket.on("data", (chunk) => {
    process.stdout.write(chunk.toString("utf-8"));
  });

  const rl = readline.createInterface({ input, output });
  console.log(`Connected to gateway at ${host}:${port}`);

  while (true) {
    const line = await rl.question("you> ");
    socket.write(`${line}\n`);
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
