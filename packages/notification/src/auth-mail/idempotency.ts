import { createHash } from "node:crypto";
import type { IdempotencyClaim, IdempotencyRecord, IdempotencyStore } from "./types";

export function buildAuthMailIdempotencyKey(input: {
  to: string;
  type: string;
  code?: string;
  link?: string;
}): string {
  const material = [
    input.to.trim().toLowerCase(),
    input.type.trim(),
    input.code ?? "",
    input.link ?? "",
  ].join("\n");
  return createHash("sha256").update(material, "utf8").digest("hex");
}

export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly rows = new Map<string, IdempotencyRecord>();

  async claim(key: string): Promise<IdempotencyClaim> {
    const existing = this.rows.get(key);
    if (existing) return { record: { ...existing }, owned: false };
    const record: IdempotencyRecord = { key, status: "pending" };
    this.rows.set(key, record);
    return { record: { ...record }, owned: true };
  }

  async reclaimFailed(key: string): Promise<IdempotencyClaim> {
    const existing = this.rows.get(key);
    if (!existing || existing.status !== "failed") {
      return {
        record: existing ? { ...existing } : { key, status: "pending" },
        owned: false,
      };
    }
    const record: IdempotencyRecord = { key, status: "pending" };
    this.rows.set(key, record);
    return { record: { ...record }, owned: true };
  }

  async save(record: IdempotencyRecord): Promise<void> {
    this.rows.set(record.key, { ...record });
  }
}
