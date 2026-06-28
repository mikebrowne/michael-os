import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { randomUUID } from "node:crypto";
import {
  type JobKind,
  type JobRecord,
  type JobStatus,
  jobRecordSchema,
  validateJobOutput,
} from "./jobKinds.js";

export type CreateJobInput = {
  kind: JobKind;
  parentWorkItem: string;
  issueNumber?: number;
  delegatedTo: string;
  input: Record<string, unknown>;
  traceId?: string;
  mastraRunId?: string;
  mastraTaskId?: string;
};

function rowToJob(row: Record<string, unknown>): JobRecord {
  return jobRecordSchema.parse({
    id: String(row.id),
    kind: row.kind,
    parentWorkItem: String(row.parent_work_item),
    issueNumber: row.issue_number != null ? Number(row.issue_number) : undefined,
    delegatedTo: String(row.delegated_to),
    status: row.status,
    input: JSON.parse(String(row.input_json)) as Record<string, unknown>,
    output: row.output_json ? JSON.parse(String(row.output_json)) : undefined,
    error: row.error != null ? String(row.error) : undefined,
    mastraRunId: row.mastra_run_id != null ? String(row.mastra_run_id) : undefined,
    mastraTaskId: row.mastra_task_id != null ? String(row.mastra_task_id) : undefined,
    traceId: row.trace_id != null ? String(row.trace_id) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    startedAt: row.started_at != null ? String(row.started_at) : undefined,
    completedAt: row.completed_at != null ? String(row.completed_at) : undefined,
  });
}

export class JobRegistry {
  private client: Client | undefined;

  constructor(private readonly mastraDir: string) {}

  private dbPath(): string {
    return join(this.mastraDir, "jobs.db");
  }

  private getClient(): Client {
    if (!this.client) {
      mkdirSync(this.mastraDir, { recursive: true });
      this.client = createClient({ url: `file:${this.dbPath()}` });
      void this.client.execute(`
        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          parent_work_item TEXT NOT NULL,
          issue_number INTEGER,
          delegated_to TEXT NOT NULL,
          status TEXT NOT NULL,
          input_json TEXT NOT NULL,
          output_json TEXT,
          error TEXT,
          mastra_run_id TEXT,
          mastra_task_id TEXT,
          trace_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          started_at TEXT,
          completed_at TEXT
        )
      `);
      void this.client.execute(
        `CREATE INDEX IF NOT EXISTS idx_jobs_work_item ON jobs(parent_work_item)`,
      );
      void this.client.execute(
        `CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)`,
      );
    }
    return this.client;
  }

  async createJob(input: CreateJobInput): Promise<JobRecord> {
    const now = new Date().toISOString();
    const job: JobRecord = {
      id: randomUUID(),
      kind: input.kind,
      parentWorkItem: input.parentWorkItem,
      issueNumber: input.issueNumber,
      delegatedTo: input.delegatedTo,
      status: "queued",
      input: input.input,
      traceId: input.traceId,
      mastraRunId: input.mastraRunId,
      mastraTaskId: input.mastraTaskId,
      createdAt: now,
      updatedAt: now,
    };
    const client = this.getClient();
    await client.execute({
      sql: `INSERT INTO jobs (
        id, kind, parent_work_item, issue_number, delegated_to, status,
        input_json, trace_id, mastra_run_id, mastra_task_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        job.id,
        job.kind,
        job.parentWorkItem,
        job.issueNumber ?? null,
        job.delegatedTo,
        job.status,
        JSON.stringify(job.input),
        job.traceId ?? null,
        job.mastraRunId ?? null,
        job.mastraTaskId ?? null,
        job.createdAt,
        job.updatedAt,
      ],
    });
    return job;
  }

  async updateJob(
    id: string,
    patch: Partial<
      Pick<
        JobRecord,
        | "status"
        | "output"
        | "error"
        | "mastraRunId"
        | "mastraTaskId"
        | "startedAt"
        | "completedAt"
      >
    >,
  ): Promise<JobRecord | undefined> {
    const existing = await this.getJob(id);
    if (!existing) return undefined;

    const updated: JobRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    if (patch.output !== undefined) {
      updated.output = validateJobOutput(updated.kind, patch.output);
    }

    const client = this.getClient();
    await client.execute({
      sql: `UPDATE jobs SET
        status = ?, output_json = ?, error = ?, mastra_run_id = ?, mastra_task_id = ?,
        started_at = ?, completed_at = ?, updated_at = ?
        WHERE id = ?`,
      args: [
        updated.status,
        updated.output != null ? JSON.stringify(updated.output) : null,
        updated.error ?? null,
        updated.mastraRunId ?? null,
        updated.mastraTaskId ?? null,
        updated.startedAt ?? null,
        updated.completedAt ?? null,
        updated.updatedAt,
        id,
      ],
    });
    return updated;
  }

  async getJob(id: string): Promise<JobRecord | undefined> {
    const client = this.getClient();
    const result = await client.execute({
      sql: `SELECT * FROM jobs WHERE id = ?`,
      args: [id],
    });
    if (result.rows.length === 0) return undefined;
    return rowToJob(result.rows[0] as Record<string, unknown>);
  }

  async listJobs(options?: {
    parentWorkItem?: string;
    status?: JobStatus | JobStatus[];
    limit?: number;
  }): Promise<JobRecord[]> {
    const client = this.getClient();
    const clauses: string[] = [];
    const args: (string | number)[] = [];

    if (options?.parentWorkItem) {
      clauses.push("parent_work_item = ?");
      args.push(options.parentWorkItem);
    }
    if (options?.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      clauses.push(`status IN (${statuses.map(() => "?").join(", ")})`);
      args.push(...statuses);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = options?.limit ?? 50;
    args.push(limit);

    const result = await client.execute({
      sql: `SELECT * FROM jobs ${where} ORDER BY created_at DESC LIMIT ?`,
      args,
    });
    return result.rows.map((row) => rowToJob(row as Record<string, unknown>));
  }

  async hasReviewJobForWorkItem(
    parentWorkItem: string,
    acceptanceHash?: string,
  ): Promise<boolean> {
    const jobs = await this.listJobs({
      parentWorkItem,
      status: ["succeeded", "running", "queued"],
      limit: 20,
    });
    return jobs.some(
      (job) =>
        job.kind === "code-review" &&
        (!acceptanceHash ||
          (job.input.acceptanceHash as string | undefined) === acceptanceHash),
    );
  }

  async close(): Promise<void> {
    if (this.client) {
      this.client.close();
      this.client = undefined;
    }
  }
}

export function createJobRegistry(mastraDir: string): JobRegistry {
  return new JobRegistry(mastraDir);
}
