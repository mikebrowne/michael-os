#!/usr/bin/env tsx
import { startGatewayDaemon } from "../src/gateway/daemon.js";

const server = await startGatewayDaemon();
process.on("SIGINT", () => {
  server.close();
  process.exit(0);
});
process.on("SIGTERM", () => {
  server.close();
  process.exit(0);
});
