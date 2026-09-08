import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { describe, expect, test } from "@rstest/core";
import { evaluateStorageAdmission } from "./admission";
import type { ObjectStorageConfig } from "./config";
import { buildObjectKey, trialObjectPrefix } from "./keys";
import { createMinioS3Client, MinioObjectStorage } from "./minio-adapter";

const SECRET = "super-secret-value-do-not-leak";
const owner = { kind: "organization" as const, id: "org_1" };

function config(overrides: Partial<ObjectStorageConfig> = {}): ObjectStorageConfig {
  return {
    endpoint: "http://object-storage:9000",
    publicEndpoint: "https://media.example.com",
    bucket: "vistaremote-recordings",
    productCode: "vistaremote",
    accessKeyId: "vr-access-key",
    secretAccessKey: SECRET,
    forcePathStyle: true,
    deletePrefixBatchSize: 2,
    ...overrides,
  };
}

interface StoredObject {
  body: Uint8Array;
  contentType?: string;
  contentLength?: number;
  metadata?: Record<string, string>;
  checksumSha256?: string;
}

function notFound(): Error {
  const err = new Error("Not Found");
  err.name = "NotFound";
  (err as Error & { $metadata: { httpStatusCode: number } }).$metadata = { httpStatusCode: 404 };
  return err;
}

/** In-memory S3 transport. No network, no live MinIO. */
class FakeS3Transport {
  readonly objects = new Map<string, StoredObject>();
  readonly commands: string[] = [];

  async send(command: unknown, options?: { abortSignal?: AbortSignal }): Promise<unknown> {
    if (options?.abortSignal?.aborted) {
      const err = new Error("Aborted");
      err.name = "AbortError";
      throw err;
    }
    const name = (command as { constructor: { name: string } }).constructor.name;
    const input = (command as { input: Record<string, any> }).input;
    this.commands.push(name);

    if (command instanceof PutObjectCommand) {
      const body =
        typeof input.Body === "string"
          ? Buffer.from(input.Body)
          : input.Body instanceof Uint8Array
            ? input.Body
            : Buffer.from(String(input.Body ?? ""));
      this.objects.set(input.Key, {
        body: new Uint8Array(body),
        contentType: input.ContentType,
        contentLength: input.ContentLength,
        metadata: input.Metadata,
        checksumSha256: input.ChecksumSHA256,
      });
      return { ETag: `"etag-${input.Key}"`, ChecksumSHA256: input.ChecksumSHA256 };
    }

    if (command instanceof GetObjectCommand) {
      const stored = this.objects.get(input.Key);
      if (!stored) throw notFound();
      return {
        Body: stored.body,
        ContentType: stored.contentType,
        ContentLength: stored.contentLength ?? stored.body.byteLength,
        ETag: `"etag-${input.Key}"`,
        Metadata: stored.metadata,
        ChecksumSHA256: stored.checksumSha256,
      };
    }

    if (command instanceof HeadObjectCommand) {
      const stored = this.objects.get(input.Key);
      if (!stored) throw notFound();
      return {
        ContentType: stored.contentType,
        ContentLength: stored.contentLength ?? stored.body.byteLength,
        ETag: `"etag-${input.Key}"`,
        Metadata: stored.metadata,
        ChecksumSHA256: stored.checksumSha256,
      };
    }

    if (command instanceof DeleteObjectCommand) {
      if (!this.objects.has(input.Key)) throw notFound();
      this.objects.delete(input.Key);
      return {};
    }

    if (command instanceof DeleteObjectsCommand) {
      for (const item of input.Delete?.Objects ?? []) {
        if (item.Key) this.objects.delete(item.Key);
      }
      return { Deleted: input.Delete?.Objects ?? [] };
    }

    if (command instanceof ListObjectsV2Command) {
      const prefix = String(input.Prefix ?? "");
      const keys = [...this.objects.keys()].filter((key) => key.startsWith(prefix)).sort();
      const start = input.ContinuationToken ? Number(input.ContinuationToken) : 0;
      const max = input.MaxKeys ?? 1000;
      const slice = keys.slice(start, start + max);
      const truncated = start + max < keys.length;
      return {
        Contents: slice.map((key) => ({
          Key: key,
          Size: this.objects.get(key)!.body.byteLength,
          ETag: `"etag-${key}"`,
        })),
        IsTruncated: truncated,
        NextContinuationToken: truncated ? String(start + max) : undefined,
      };
    }

    throw new Error(`unexpected command ${name}`);
  }
}

function storageWithMock(transport: FakeS3Transport, overrides: Partial<ObjectStorageConfig> = {}) {
  const cfg = config(overrides);
  const client = createMinioS3Client(cfg);
  const presignClient = createMinioS3Client(cfg, cfg.publicEndpoint);
  client.send = transport.send.bind(transport) as typeof client.send;
  return { storage: new MinioObjectStorage(cfg, { client, presignClient }), client };
}

describe("MinioObjectStorage with mocked SDK transport", () => {
  test("put/get/head round-trip content type, length, checksum and ownership metadata", async () => {
    const transport = new FakeS3Transport();
    const { storage } = storageWithMock(transport);
    const built = buildObjectKey({
      productCode: "vistaremote",
      billingOwner: owner,
      trialRedemptionId: "tr_abc",
      path: "recordings/session.webm",
    });
    const body = Buffer.from("webm-bytes");
    await storage.put({
      key: built.key,
      body,
      contentType: "video/webm",
      checksum: { algorithm: "SHA256", value: "dGVzdGNoZWNrc3Vt" },
      contentChecksum: "sha256:abc",
    });

    const head = await storage.head(built.key);
    expect(head.contentType).toBe("video/webm");
    expect(head.contentLength).toBe(body.byteLength);
    expect(head.checksum).toEqual({ algorithm: "SHA256", value: "dGVzdGNoZWNrc3Vt" });
    expect(head.ownership["lw-trial-redemption-id"]).toBe("tr_abc");
    expect(head.ownership["lw-billing-owner-id"]).toBe("org_1");
    expect(head.metadata["lw-content-checksum"]).toBe("sha256:abc");

    const got = await storage.get(built.key);
    expect(Buffer.from(got.body).toString()).toBe("webm-bytes");
  });

  test("presigned PUT/GET use the public endpoint, path-style bucket, and bounded TTL", async () => {
    const transport = new FakeS3Transport();
    const { storage } = storageWithMock(transport);
    const built = buildObjectKey({
      productCode: "vistaremote",
      billingOwner: owner,
      path: "clips/one.webm",
    });

    const upload = await storage.presignUpload({ key: built.key, expiresInSeconds: 120 });
    const uploadUrl = new URL(upload.url);
    expect(upload.method).toBe("PUT");
    expect(upload.expiresInSeconds).toBe(120);
    expect(uploadUrl.hostname).toBe("media.example.com");
    expect(uploadUrl.pathname.startsWith("/vistaremote-recordings/")).toBe(true);
    expect(uploadUrl.pathname).toContain(built.key);
    expect(uploadUrl.searchParams.get("X-Amz-Expires")).toBe("120");
    expect(upload.url).not.toContain("object-storage");
    expect(upload.url).not.toContain(SECRET);

    await expect(
      storage.presignUpload({ key: built.key, expiresInSeconds: 901 }),
    ).rejects.toMatchObject({
      code: "PRESIGN_TTL_EXCEEDED",
    });

    const download = await storage.presignDownload({ key: built.key });
    expect(download.method).toBe("GET");
    expect(download.expiresInSeconds).toBe(600);
    expect(new URL(download.url).searchParams.get("X-Amz-Expires")).toBe("600");
  });

  test("listPrefix paginates; delete is idempotent; deletePrefix purges only the trial prefix", async () => {
    const transport = new FakeS3Transport();
    const { storage } = storageWithMock(transport);
    const trialA = trialObjectPrefix({
      productCode: "vistaremote",
      billingOwner: owner,
      trialRedemptionId: "tr_1",
    });
    const keys = [
      buildObjectKey({
        productCode: "vistaremote",
        billingOwner: owner,
        trialRedemptionId: "tr_1",
        path: "a.bin",
      }).key,
      buildObjectKey({
        productCode: "vistaremote",
        billingOwner: owner,
        trialRedemptionId: "tr_1",
        path: "b.bin",
      }).key,
      buildObjectKey({
        productCode: "vistaremote",
        billingOwner: owner,
        trialRedemptionId: "tr_1",
        path: "c.bin",
      }).key,
      buildObjectKey({
        productCode: "vistaremote",
        billingOwner: owner,
        trialRedemptionId: "tr_10",
        path: "keep.bin",
      }).key,
      buildObjectKey({
        productCode: "vistaremote",
        billingOwner: owner,
        path: "paid.bin",
      }).key,
    ];
    for (const key of keys) {
      await storage.put({ key, body: Buffer.from(key) });
    }

    const page1 = await storage.listPrefix(trialA, { limit: 2 });
    expect(page1.objects).toHaveLength(2);
    expect(page1.truncated).toBe(true);
    expect(page1.nextCursor).toBeTruthy();
    const page2 = await storage.listPrefix(trialA, { cursor: page1.nextCursor, limit: 2 });
    expect(page2.objects).toHaveLength(1);
    expect(page2.truncated).toBe(false);

    const missing = buildObjectKey({
      productCode: "vistaremote",
      billingOwner: owner,
      path: "never-written.bin",
    }).key;
    await expect(storage.delete(missing)).resolves.toEqual({ key: missing, deleted: true });

    const purged = await storage.deletePrefix(trialA, { batchSize: 2 });
    expect(purged.deleted).toBe(3);
    expect(purged.batches).toBe(2);
    expect(transport.objects.has(keys[0]!)).toBe(false);
    expect(transport.objects.has(keys[3]!)).toBe(true);
    expect(transport.objects.has(keys[4]!)).toBe(true);

    await expect(storage.deletePrefix(trialA)).resolves.toEqual({
      prefix: trialA,
      deleted: 0,
      batches: 0,
    });
  });

  test("deletePrefix honors abort and rejects an unscoped prefix", async () => {
    const transport = new FakeS3Transport();
    const { storage } = storageWithMock(transport);
    const built = buildObjectKey({
      productCode: "vistaremote",
      billingOwner: owner,
      trialRedemptionId: "tr_abort",
      path: "clip.webm",
    });
    await storage.put({ key: built.key, body: Buffer.from("x") });
    const controller = new AbortController();
    controller.abort();
    await expect(
      storage.deletePrefix(built.trialPrefix!, { signal: controller.signal }),
    ).rejects.toMatchObject({ code: "ABORTED" });
    await expect(storage.deletePrefix("trial/")).rejects.toMatchObject({
      code: "PREFIX_NOT_ALLOWED",
    });
    await expect(
      storage.deletePrefix("trial/vistaremote/organization/org_1/"),
    ).rejects.toMatchObject({
      code: "PREFIX_NOT_ALLOWED",
    });
    await expect(
      storage.deletePrefix("vistaremote/organization/org_1/trial/tr_abort/"),
    ).rejects.toMatchObject({ code: "PREFIX_NOT_ALLOWED" });
    expect(built.key.startsWith("trial/")).toBe(true);
  });

  test("injected admission rejects trial recording/object writes at watermarks; deletes still succeed", async () => {
    const transport = new FakeS3Transport();
    const { storage } = storageWithMock(transport);
    const trial = buildObjectKey({
      productCode: "vistaremote",
      billingOwner: owner,
      trialRedemptionId: "tr_gate",
      path: "rec.webm",
    });
    const paid = buildObjectKey({
      productCode: "vistaremote",
      billingOwner: owner,
      path: "paid.webm",
    });
    const at70 = evaluateStorageAdmission(Math.ceil(128849018880 * 0.7));
    const at80 = evaluateStorageAdmission(Math.ceil(128849018880 * 0.8));
    const at90 = evaluateStorageAdmission(Math.ceil(128849018880 * 0.9));

    await expect(
      storage.put({
        key: trial.key,
        body: Buffer.from("x"),
        admission: at70,
        intent: "trialRecording",
      }),
    ).rejects.toMatchObject({ code: "STORAGE_ADMISSION_DENIED" });

    await storage.put({ key: trial.key, body: Buffer.from("ok"), admission: at70 });

    await expect(storage.presignUpload({ key: trial.key, admission: at80 })).rejects.toMatchObject({
      code: "STORAGE_ADMISSION_DENIED",
    });

    await expect(
      storage.put({ key: paid.key, body: Buffer.from("x"), admission: at90 }),
    ).rejects.toMatchObject({ code: "STORAGE_ADMISSION_DENIED" });

    await expect(storage.delete(trial.key)).resolves.toEqual({ key: trial.key, deleted: true });
  });

  test("redacted config is safe to log", () => {
    const transport = new FakeS3Transport();
    const { storage } = storageWithMock(transport);
    const json = JSON.stringify(storage.redactConfig());
    expect(json).not.toContain(SECRET);
  });
});
