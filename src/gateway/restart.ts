import { EventEmitter } from "node:events";

export const RESTART_SENTINEL_EXIT_CODE = 75;

export type RestartLifecycleEvent =
  | { type: "restarting"; inFlight: number }
  | { type: "down" }
  | { type: "up"; commitSha: string };

export const restartLifecycleBus = new EventEmitter();

export type RestartGate = {
  isDraining: () => boolean;
  beginDrain: () => number;
  allowNewJob: () => boolean;
  onJobStart: () => void;
  onJobEnd: () => void;
  getInFlight: () => number;
};

export function createRestartGate(): RestartGate {
  let draining = false;
  let inFlight = 0;

  return {
    isDraining: () => draining,
    beginDrain: () => {
      draining = true;
      return inFlight;
    },
    allowNewJob: () => !draining,
    onJobStart: () => {
      inFlight += 1;
    },
    onJobEnd: () => {
      inFlight = Math.max(0, inFlight - 1);
    },
    getInFlight: () => inFlight,
  };
}

export type ControlledRestartInput = {
  restartGate: RestartGate;
  persistState: () => void | Promise<void>;
  flushTelemetry: () => void | Promise<void>;
  getHeadCommitSha: () => string;
  exitProcess: (code: number) => void;
  waitForDrainMs?: number;
};

function waitForInFlightDrain(
  gate: RestartGate,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (gate.getInFlight() === 0 || Date.now() - started >= timeoutMs) {
        resolve();
        return;
      }
      setTimeout(tick, 5);
    };
    tick();
  });
}

export async function executeControlledRestart(
  input: ControlledRestartInput,
): Promise<void> {
  const inFlight = input.restartGate.beginDrain();
  restartLifecycleBus.emit("lifecycle", {
    type: "restarting",
    inFlight,
  } satisfies RestartLifecycleEvent);

  await waitForInFlightDrain(input.restartGate, input.waitForDrainMs ?? 30_000);

  await input.flushTelemetry();
  await input.persistState();

  restartLifecycleBus.emit("lifecycle", { type: "down" } satisfies RestartLifecycleEvent);
  input.exitProcess(RESTART_SENTINEL_EXIT_CODE);
}

export function promotionTouchesHarness(changedFiles: string[]): boolean {
  return changedFiles.some(
    (file) => file.startsWith("src/") || file.startsWith("src\\"),
  );
}

export function formatRestartLifecycleMessage(
  event: RestartLifecycleEvent,
): string {
  if (event.type === "restarting") {
    return `[harness] Restarting — draining ${event.inFlight} in-flight job(s)…`;
  }
  if (event.type === "down") {
    return "[harness] Gateway going down for restart. Reconnecting…";
  }
  return `[harness] Back up (commit ${event.commitSha.slice(0, 8)}).`;
}

export function emitHarnessBackUp(commitSha: string): void {
  restartLifecycleBus.emit("lifecycle", {
    type: "up",
    commitSha,
  } satisfies RestartLifecycleEvent);
}
