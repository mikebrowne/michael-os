import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { randomUUID } from "node:crypto";
import type { ObservabilityConfig } from "./observabilityConfig.js";
import { shouldEmitAtLevel } from "./observabilityConfig.js";
import {
  createObservabilityEvent,
  type ObservabilityCorrelation,
  type ObservabilityEvent,
} from "./observabilityEvent.js";
import { redactUnknown } from "./redaction.js";
import { pruneOldLogFiles, rotateJsonlIfNeeded } from "./retention.js";

export type ObservabilityStoreOptions = {
  logDir: string;
  mastraDir: string;
  config: ObservabilityConfig;
  sessionId?: string;
};

export class ObservabilityStore {
  readonly sessionId: string;
  private readonly logFilePath: string;
  private readonly traceDbPath: string;
  private client: Client | undefined;
  private readonly config: ObservabilityConfig;

  constructor(private readonly options: ObservabilityStoreOptions) {
    this.sessionId = options.sessionId ?? randomUUID();
    this.config = options.config;
    mkdirSync(options.logDir, { recursive: true });
    mkdirSync(options.mastraDir, { recursive: true });
    this.logFilePath = join(options.logDir, "observability.jsonl");
    this.traceDbPath = join(options.mastraDir, "traces.db");
  }

  private getClient(): Client {
    if (!this.client) {
      this.client = createClient({ url: `file:${this.traceDbPath}` });
      void this.client.execute(`
        CREATE TABLE IF NOT EXISTS observability_traces (
          id TEXT PRIMARY KEY,
          event TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          correlation_json TEXT NOT NULL,
          data_json TEXT
        )
      `);
    }
    return this.client;
  }

  emit(
    event: string,
    correlation: ObservabilityCorrelation = {},
    data?: Record<string, unknown>,
    requiredLevel: ObservabilityConfig["level"] = "minimal",
  ): ObservabilityEvent | undefined {
    if (!shouldEmitAtLevel(this.config.level, requiredLevel)) {
      return undefined;
    }
    if (
      this.config.level !== "debug" &&
      this.config.sampleRate < 1 &&
      Math.random() > this.config.sampleRate
    ) {
      return undefined;
    }

    const record = createObservabilityEvent(
      event,
      {
        sessionId: this.sessionId,
        traceId: correlation.traceId ?? randomUUID(),
        ...correlation,
      },
      redactUnknown(data) as Record<string, unknown> | undefined,
    );

    rotateJsonlIfNeeded(this.logFilePath, this.config.maxLogBytes);
    appendFileSync(this.logFilePath, `${JSON.stringify(record)}\n`, "utf-8");

    if (shouldEmitAtLevel(this.config.level, "standard")) {
      const client = this.getClient();
      const rowId = randomUUID();
      void client.execute({
        sql: `INSERT INTO observability_traces (id, event, timestamp, correlation_json, data_json)
              VALUES (?, ?, ?, ?, ?)`,
        args: [
          rowId,
          record.event,
          record.timestamp,
          JSON.stringify(record.correlation),
          record.data ? JSON.stringify(record.data) : null,
        ],
      });
    }

    return record;
  }

  prune(): number {
    return pruneOldLogFiles(this.options.logDir, this.config.maxLogAgeDays);
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }

  async queryByEvent(event: string, limit = 50): Promise<ObservabilityEvent[]> {
    if (!shouldEmitAtLevel(this.config.level, "standard")) {
      return [];
    }
    const client = this.getClient();
    const result = await client.execute({
      sql: `SELECT event, timestamp, correlation_json, data_json FROM observability_traces
            WHERE event = ? ORDER BY timestamp DESC LIMIT ?`,
      args: [event, limit],
    });
    return result.rows.map((row) => ({
      version: 1,
      event: String(row.event),
      timestamp: String(row.timestamp),
      correlation: JSON.parse(String(row.correlation_json)) as ObservabilityCorrelation,
      data: row.data_json
        ? (JSON.parse(String(row.data_json)) as Record<string, unknown>)
        : undefined,
    }));
  }

  async close(): Promise<void> {
    if (this.client) {
      this.client.close();
      this.client = undefined;
    }
  }
}

export function createObservabilityStore(
  options: ObservabilityStoreOptions,
): ObservabilityStore {
  return new ObservabilityStore(options);
}
