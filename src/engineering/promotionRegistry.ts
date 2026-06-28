import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { z } from "zod";

export const promotionStatusSchema = z.enum(["promoted", "rolled-back"]);
export type PromotionStatus = z.infer<typeof promotionStatusSchema>;

export const gateOverrideSchema = z.object({
  kind: z.string(),
  overridden: z.boolean(),
});

export const promotionRecordSchema = z.object({
  id: z.string(),
  promotionNumber: z.number(),
  commitSha: z.string(),
  revertCommitSha: z.string().optional(),
  parentWorkItem: z.string(),
  issueNumber: z.number().optional(),
  jobId: z.string().optional(),
  prNumber: z.number(),
  branchName: z.string(),
  gatesPassed: z.array(z.string()),
  gatesOverridden: z.array(gateOverrideSchema),
  status: promotionStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PromotionRecord = z.infer<typeof promotionRecordSchema>;
export type GateOverride = z.infer<typeof gateOverrideSchema>;

export type CreatePromotionInput = {
  commitSha: string;
  parentWorkItem: string;
  issueNumber?: number;
  jobId?: string;
  prNumber: number;
  branchName: string;
  gatesPassed?: string[];
  gatesOverridden?: GateOverride[];
};

function rowToPromotion(row: Record<string, unknown>): PromotionRecord {
  return promotionRecordSchema.parse({
    id: String(row.id),
    promotionNumber: Number(row.promotion_number),
    commitSha: String(row.commit_sha),
    revertCommitSha:
      row.revert_commit_sha != null ? String(row.revert_commit_sha) : undefined,
    parentWorkItem: String(row.parent_work_item),
    issueNumber: row.issue_number != null ? Number(row.issue_number) : undefined,
    jobId: row.job_id != null ? String(row.job_id) : undefined,
    prNumber: Number(row.pr_number),
    branchName: String(row.branch_name),
    gatesPassed: JSON.parse(String(row.gates_passed_json)) as string[],
    gatesOverridden: JSON.parse(String(row.gates_overridden_json)) as GateOverride[],
    status: row.status,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  });
}

export class PromotionRegistry {
  private client: Client | undefined;

  constructor(private readonly mastraDir: string) {}

  private dbPath(): string {
    return join(this.mastraDir, "promotions.db");
  }

  private getClient(): Client {
    if (!this.client) {
      mkdirSync(this.mastraDir, { recursive: true });
      this.client = createClient({ url: `file:${this.dbPath()}` });
      void this.client.execute(`
        CREATE TABLE IF NOT EXISTS promotions (
          id TEXT PRIMARY KEY,
          promotion_number INTEGER NOT NULL UNIQUE,
          commit_sha TEXT NOT NULL,
          revert_commit_sha TEXT,
          parent_work_item TEXT NOT NULL,
          issue_number INTEGER,
          job_id TEXT,
          pr_number INTEGER NOT NULL,
          branch_name TEXT NOT NULL,
          gates_passed_json TEXT NOT NULL,
          gates_overridden_json TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      void this.client.execute(
        `CREATE INDEX IF NOT EXISTS idx_promotions_work_item ON promotions(parent_work_item)`,
      );
    }
    return this.client;
  }

  private async nextPromotionNumber(): Promise<number> {
    const client = this.getClient();
    const result = await client.execute(
      `SELECT MAX(promotion_number) AS max_num FROM promotions`,
    );
    const max = result.rows[0]?.max_num;
    return typeof max === "number" ? max + 1 : 1;
  }

  async createPromotion(input: CreatePromotionInput): Promise<PromotionRecord> {
    const now = new Date().toISOString();
    const promotionNumber = await this.nextPromotionNumber();
    const record: PromotionRecord = {
      id: randomUUID(),
      promotionNumber,
      commitSha: input.commitSha,
      parentWorkItem: input.parentWorkItem,
      issueNumber: input.issueNumber,
      jobId: input.jobId,
      prNumber: input.prNumber,
      branchName: input.branchName,
      gatesPassed: input.gatesPassed ?? [],
      gatesOverridden: input.gatesOverridden ?? [],
      status: "promoted",
      createdAt: now,
      updatedAt: now,
    };

    const client = this.getClient();
    await client.execute({
      sql: `INSERT INTO promotions (
        id, promotion_number, commit_sha, parent_work_item, issue_number, job_id,
        pr_number, branch_name, gates_passed_json, gates_overridden_json,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        record.id,
        record.promotionNumber,
        record.commitSha,
        record.parentWorkItem,
        record.issueNumber ?? null,
        record.jobId ?? null,
        record.prNumber,
        record.branchName,
        JSON.stringify(record.gatesPassed),
        JSON.stringify(record.gatesOverridden),
        record.status,
        record.createdAt,
        record.updatedAt,
      ],
    });
    return record;
  }

  async updatePromotion(
    id: string,
    patch: Partial<Pick<PromotionRecord, "status" | "revertCommitSha">>,
  ): Promise<PromotionRecord | undefined> {
    const existing = await this.getPromotion(id);
    if (!existing) return undefined;

    const updated: PromotionRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    const client = this.getClient();
    await client.execute({
      sql: `UPDATE promotions SET
        status = ?, revert_commit_sha = ?, updated_at = ?
        WHERE id = ?`,
      args: [
        updated.status,
        updated.revertCommitSha ?? null,
        updated.updatedAt,
        id,
      ],
    });
    return updated;
  }

  async getPromotion(id: string): Promise<PromotionRecord | undefined> {
    const client = this.getClient();
    const result = await client.execute({
      sql: `SELECT * FROM promotions WHERE id = ?`,
      args: [id],
    });
    if (result.rows.length === 0) return undefined;
    return rowToPromotion(result.rows[0] as Record<string, unknown>);
  }

  async getPromotionByNumber(
    promotionNumber: number,
  ): Promise<PromotionRecord | undefined> {
    const client = this.getClient();
    const result = await client.execute({
      sql: `SELECT * FROM promotions WHERE promotion_number = ?`,
      args: [promotionNumber],
    });
    if (result.rows.length === 0) return undefined;
    return rowToPromotion(result.rows[0] as Record<string, unknown>);
  }

  async listPromotions(options?: { limit?: number }): Promise<PromotionRecord[]> {
    const client = this.getClient();
    const limit = options?.limit ?? 50;
    const result = await client.execute({
      sql: `SELECT * FROM promotions ORDER BY promotion_number DESC LIMIT ?`,
      args: [limit],
    });
    return result.rows.map((row) =>
      rowToPromotion(row as Record<string, unknown>),
    );
  }

  async close(): Promise<void> {
    if (this.client) {
      this.client.close();
      this.client = undefined;
    }
  }
}

export function createPromotionRegistry(mastraDir: string): PromotionRegistry {
  return new PromotionRegistry(mastraDir);
}
