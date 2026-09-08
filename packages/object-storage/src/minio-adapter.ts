import {
  type ChecksumAlgorithm,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertStorageAdmission, inferWriteIntent } from "./admission";
import {
  boundPresignTtl,
  type ObjectStorageConfig,
  type ResolvedObjectStorageConfig,
  redactObjectStorageConfig,
  validateObjectStorageConfig,
} from "./config";
import { ObjectStorageError, throwIfAborted } from "./errors";
import {
  assertKeyProductScope,
  assertListPrefix,
  assertTrialPurgePrefix,
  type ObjectOwnershipMetadata,
  OWNERSHIP_METADATA_KEYS,
} from "./keys";
import type {
  DeletePrefixOptions,
  DeletePrefixResult,
  ObjectContentChecksum,
  ObjectDeleteResult,
  ObjectGetResult,
  ObjectHeadResult,
  ObjectListOptions,
  ObjectListResult,
  ObjectPutInput,
  ObjectPutResult,
  ObjectStoragePort,
  ObjectWriteOptions,
  PresignDownloadInput,
  PresignResult,
  PresignUploadInput,
} from "./port";

export interface MinioObjectStorageDeps {
  /** Injected S3 client (data plane). Tests mock `send` / requestHandler. */
  client?: S3Client;
  /** Injected client used only for SigV4 presign (public/CDN endpoint). */
  presignClient?: S3Client;
}

function s3Credentials(config: ResolvedObjectStorageConfig) {
  return {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    sessionToken: config.sessionToken,
  };
}

function createS3Client(endpoint: string, config: ResolvedObjectStorageConfig): S3Client {
  return new S3Client({
    region: config.region,
    endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: s3Credentials(config),
  });
}

function isNotFound(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = "name" in err ? String((err as { name?: unknown }).name) : "";
  const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  return (
    name === "NotFound" || name === "NoSuchKey" || name === "NotFoundException" || status === 404
  );
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = "name" in err ? String((err as { name?: unknown }).name) : "";
  return name === "AbortError" || name === "TimeoutError";
}

function wrapTransportError(err: unknown): never {
  if (err instanceof ObjectStorageError) throw err;
  if (isAbortError(err)) {
    throw new ObjectStorageError("ABORTED", "Object storage operation aborted", { cause: err });
  }
  if (isNotFound(err)) {
    throw new ObjectStorageError("OBJECT_NOT_FOUND", "Object not found", { cause: err });
  }
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name: unknown }).name)
      : "Error";
  throw new ObjectStorageError("TRANSPORT_FAILED", `Object storage request failed (${name})`, {
    cause: err,
  });
}

async function readBody(body: unknown): Promise<Uint8Array> {
  if (body == null) return new Uint8Array();
  if (body instanceof Uint8Array) return body;
  if (typeof body === "string") return Buffer.from(body);
  const withTransform = body as { transformToByteArray?: () => Promise<Uint8Array> };
  if (typeof withTransform.transformToByteArray === "function") {
    return await withTransform.transformToByteArray();
  }
  if (typeof (body as { on?: unknown }).on === "function" || Symbol.asyncIterator in Object(body)) {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Buffer | Uint8Array | string>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new ObjectStorageError("TRANSPORT_FAILED", "Unsupported GetObject body");
}

function checksumFromS3(output: {
  ChecksumSHA256?: string;
  ChecksumCRC32?: string;
  ChecksumCRC32C?: string;
}): ObjectContentChecksum | undefined {
  if (output.ChecksumSHA256) return { algorithm: "SHA256", value: output.ChecksumSHA256 };
  if (output.ChecksumCRC32) return { algorithm: "CRC32", value: output.ChecksumCRC32 };
  if (output.ChecksumCRC32C) return { algorithm: "CRC32C", value: output.ChecksumCRC32C };
  return undefined;
}

function putChecksumFields(checksum?: ObjectContentChecksum): {
  ChecksumAlgorithm?: ChecksumAlgorithm;
  ChecksumSHA256?: string;
  ChecksumCRC32?: string;
  ChecksumCRC32C?: string;
} {
  if (!checksum) return {};
  if (checksum.algorithm === "SHA256") {
    return { ChecksumAlgorithm: "SHA256", ChecksumSHA256: checksum.value };
  }
  if (checksum.algorithm === "CRC32") {
    return { ChecksumAlgorithm: "CRC32", ChecksumCRC32: checksum.value };
  }
  return { ChecksumAlgorithm: "CRC32C", ChecksumCRC32C: checksum.value };
}

function mergeUserMetadata(
  ownership: ObjectOwnershipMetadata,
  extra?: Record<string, string>,
  contentChecksum?: string,
): Record<string, string> {
  const reserved = new Set<string>(Object.values(OWNERSHIP_METADATA_KEYS));
  const metadata: Record<string, string> = { ...ownership };
  if (contentChecksum) {
    metadata[OWNERSHIP_METADATA_KEYS.contentChecksum] = contentChecksum;
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      const normalized = key.toLowerCase();
      if (reserved.has(normalized) || reserved.has(key)) {
        throw new ObjectStorageError(
          "INVALID_OBJECT_KEY",
          `metadata key '${key}' is reserved for ownership`,
        );
      }
      metadata[key] = value;
    }
  }
  return metadata;
}

function ownershipFromMetadata(
  metadata: Record<string, string> | undefined,
): ObjectOwnershipMetadata {
  const raw = metadata ?? {};
  const productCode = raw[OWNERSHIP_METADATA_KEYS.productCode] ?? "";
  const billingOwnerKind = (raw[OWNERSHIP_METADATA_KEYS.billingOwnerKind] ??
    "user") as ObjectOwnershipMetadata[typeof OWNERSHIP_METADATA_KEYS.billingOwnerKind];
  const billingOwnerId = raw[OWNERSHIP_METADATA_KEYS.billingOwnerId] ?? "";
  const result: ObjectOwnershipMetadata = {
    [OWNERSHIP_METADATA_KEYS.productCode]: productCode,
    [OWNERSHIP_METADATA_KEYS.billingOwnerKind]: billingOwnerKind,
    [OWNERSHIP_METADATA_KEYS.billingOwnerId]: billingOwnerId,
  };
  if (raw[OWNERSHIP_METADATA_KEYS.trialRedemptionId]) {
    result[OWNERSHIP_METADATA_KEYS.trialRedemptionId] =
      raw[OWNERSHIP_METADATA_KEYS.trialRedemptionId];
  }
  if (raw[OWNERSHIP_METADATA_KEYS.contentChecksum]) {
    result[OWNERSHIP_METADATA_KEYS.contentChecksum] = raw[OWNERSHIP_METADATA_KEYS.contentChecksum];
  }
  return result;
}

function signedHeaders(input: {
  contentType?: string;
  contentLength?: number;
  checksum?: ObjectContentChecksum;
  metadata: Record<string, string>;
}): Record<string, string> {
  const headers: Record<string, string> = {};
  if (input.contentType) headers["Content-Type"] = input.contentType;
  if (input.contentLength !== undefined) headers["Content-Length"] = String(input.contentLength);
  if (input.checksum?.algorithm === "SHA256")
    headers["x-amz-checksum-sha256"] = input.checksum.value;
  if (input.checksum?.algorithm === "CRC32") headers["x-amz-checksum-crc32"] = input.checksum.value;
  if (input.checksum?.algorithm === "CRC32C")
    headers["x-amz-checksum-crc32c"] = input.checksum.value;
  for (const [key, value] of Object.entries(input.metadata)) {
    headers[`x-amz-meta-${key}`] = value;
  }
  return headers;
}

export class MinioObjectStorage implements ObjectStoragePort {
  readonly bucket: string;
  readonly productCode: string;
  private readonly config: ResolvedObjectStorageConfig;
  private readonly client: S3Client;
  private readonly presignClient: S3Client;

  constructor(config: ObjectStorageConfig, deps: MinioObjectStorageDeps = {}) {
    this.config = validateObjectStorageConfig(config);
    this.bucket = this.config.bucket;
    this.productCode = this.config.productCode;
    this.client = deps.client ?? createS3Client(this.config.endpoint, this.config);
    this.presignClient =
      deps.presignClient ??
      createS3Client(this.config.publicEndpoint ?? this.config.endpoint, this.config);
  }

  redactConfig(): Record<string, unknown> {
    return redactObjectStorageConfig(this.config);
  }

  private scopedKey(key: string) {
    return assertKeyProductScope(key, this.productCode);
  }

  /**
   * Enforce injected admission on writes. When `admission` is omitted, the
   * caller is responsible for gating (so private endpoints without a host
   * status file still work). Passing `admission` fail-closes against the
   * 70/80/90 matrix. Deletes never call this.
   */
  private maybeAdmitWrite(key: string, options?: ObjectWriteOptions): void {
    const parsed = this.scopedKey(key);
    if (!options?.admission) return;
    const intent = inferWriteIntent(Boolean(parsed.trialRedemptionId), options.intent);
    assertStorageAdmission(options.admission, intent);
  }

  private async send<T>(command: unknown, signal?: AbortSignal): Promise<T> {
    throwIfAborted(signal);
    try {
      return (await this.client.send(
        command as never,
        signal ? { abortSignal: signal } : undefined,
      )) as T;
    } catch (err) {
      wrapTransportError(err);
    }
  }

  async put(input: ObjectPutInput): Promise<ObjectPutResult> {
    this.maybeAdmitWrite(input.key, input);
    const parsed = this.scopedKey(input.key);
    const metadata = mergeUserMetadata(parsed.metadata, input.metadata, input.contentChecksum);
    const checksumFields = putChecksumFields(input.checksum);
    const contentLength =
      input.contentLength ??
      (typeof input.body === "string"
        ? Buffer.byteLength(input.body)
        : input.body instanceof Uint8Array
          ? input.body.byteLength
          : undefined);

    const output = await this.send<{
      ETag?: string;
      ChecksumSHA256?: string;
      ChecksumCRC32?: string;
      ChecksumCRC32C?: string;
    }>(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: parsed.key,
        Body: input.body,
        ContentType: input.contentType,
        ContentLength: contentLength,
        Metadata: metadata,
        ...checksumFields,
      }),
      input.signal,
    );

    return {
      key: parsed.key,
      eTag: output.ETag,
      checksum: checksumFromS3(output) ?? input.checksum,
    };
  }

  async get(key: string, options?: { signal?: AbortSignal }): Promise<ObjectGetResult> {
    const parsed = this.scopedKey(key);
    const output = await this.send<{
      Body?: unknown;
      ContentType?: string;
      ContentLength?: number;
      ETag?: string;
      Metadata?: Record<string, string>;
      ChecksumSHA256?: string;
      ChecksumCRC32?: string;
      ChecksumCRC32C?: string;
    }>(new GetObjectCommand({ Bucket: this.bucket, Key: parsed.key }), options?.signal);

    const body = await readBody(output.Body);
    return {
      key: parsed.key,
      body,
      contentType: output.ContentType,
      contentLength: output.ContentLength ?? body.byteLength,
      eTag: output.ETag,
      checksum: checksumFromS3(output),
      metadata: output.Metadata ?? {},
      ownership: ownershipFromMetadata(output.Metadata),
    };
  }

  async head(key: string, options?: { signal?: AbortSignal }): Promise<ObjectHeadResult> {
    const parsed = this.scopedKey(key);
    const output = await this.send<{
      ContentType?: string;
      ContentLength?: number;
      ETag?: string;
      Metadata?: Record<string, string>;
      ChecksumSHA256?: string;
      ChecksumCRC32?: string;
      ChecksumCRC32C?: string;
    }>(new HeadObjectCommand({ Bucket: this.bucket, Key: parsed.key }), options?.signal);

    return {
      key: parsed.key,
      contentType: output.ContentType,
      contentLength: output.ContentLength,
      eTag: output.ETag,
      checksum: checksumFromS3(output),
      metadata: output.Metadata ?? {},
      ownership: ownershipFromMetadata(output.Metadata),
    };
  }

  async delete(key: string, options?: { signal?: AbortSignal }): Promise<ObjectDeleteResult> {
    const parsed = this.scopedKey(key);
    try {
      await this.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: parsed.key }),
        options?.signal,
      );
    } catch (err) {
      if (err instanceof ObjectStorageError && err.code === "OBJECT_NOT_FOUND") {
        return { key: parsed.key, deleted: true };
      }
      throw err;
    }
    return { key: parsed.key, deleted: true };
  }

  async listPrefix(prefix: string, options?: ObjectListOptions): Promise<ObjectListResult> {
    const scoped = assertListPrefix(prefix, this.productCode);
    const limit = options?.limit;
    if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0 || limit > 1000)) {
      throw new ObjectStorageError(
        "INVALID_CONFIG",
        "listPrefix limit must be an integer between 1 and 1000",
      );
    }
    const output = await this.send<{
      Contents?: Array<{ Key?: string; Size?: number; LastModified?: Date; ETag?: string }>;
      IsTruncated?: boolean;
      NextContinuationToken?: string;
    }>(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: scoped,
        ContinuationToken: options?.cursor,
        MaxKeys: limit,
      }),
      options?.signal,
    );

    const objects = (output.Contents ?? [])
      .filter((item) => item.Key)
      .map((item) => ({
        key: item.Key as string,
        size: item.Size,
        lastModified: item.LastModified,
        eTag: item.ETag,
      }));

    return {
      prefix: scoped,
      objects,
      nextCursor: output.IsTruncated ? output.NextContinuationToken : undefined,
      truncated: Boolean(output.IsTruncated),
    };
  }

  async presignUpload(input: PresignUploadInput): Promise<PresignResult> {
    this.maybeAdmitWrite(input.key, input);
    const parsed = this.scopedKey(input.key);
    const expiresInSeconds = boundPresignTtl(
      input.expiresInSeconds,
      this.config.defaultUploadTtlSeconds,
      this.config.maxPresignTtlSeconds,
    );
    const metadata = mergeUserMetadata(parsed.metadata, input.metadata, input.contentChecksum);
    const checksumFields = putChecksumFields(input.checksum);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: parsed.key,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
      Metadata: metadata,
      ...checksumFields,
    });
    const url = await getSignedUrl(this.presignClient, command, { expiresIn: expiresInSeconds });
    return {
      url,
      method: "PUT",
      expiresInSeconds,
      headers: signedHeaders({
        contentType: input.contentType,
        contentLength: input.contentLength,
        checksum: input.checksum,
        metadata,
      }),
    };
  }

  async presignDownload(input: PresignDownloadInput): Promise<PresignResult> {
    const parsed = this.scopedKey(input.key);
    const expiresInSeconds = boundPresignTtl(
      input.expiresInSeconds,
      this.config.defaultDownloadTtlSeconds,
      this.config.maxPresignTtlSeconds,
    );
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: parsed.key,
      ResponseContentType: input.responseContentType,
    });
    const url = await getSignedUrl(this.presignClient, command, { expiresIn: expiresInSeconds });
    return { url, method: "GET", expiresInSeconds, headers: {} };
  }

  async deletePrefix(prefix: string, options?: DeletePrefixOptions): Promise<DeletePrefixResult> {
    // Only `trial/{product}/{ownerKind}/{ownerId}/{trialRedemptionId}/`.
    // Rejects lifecycle root `trial/`, owner-wide trial prefixes, and `obj/`.
    const scoped = assertTrialPurgePrefix(prefix, this.productCode);
    const batchSize = options?.batchSize ?? this.config.deletePrefixBatchSize;
    if (!Number.isInteger(batchSize) || batchSize <= 0 || batchSize > 1000) {
      throw new ObjectStorageError(
        "INVALID_CONFIG",
        "deletePrefix batchSize must be an integer between 1 and 1000",
      );
    }

    let deleted = 0;
    let batches = 0;

    // Re-list from the prefix start after each batch. Continuing a ListObjects
    // cursor across deletes can skip keys; trial purge must be exact.
    for (;;) {
      throwIfAborted(options?.signal);
      const page = await this.listPrefix(scoped, {
        limit: batchSize,
        signal: options?.signal,
      });
      if (page.objects.length === 0) break;

      batches += 1;
      throwIfAborted(options?.signal);
      await this.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: page.objects.map((item) => ({ Key: item.key })),
            Quiet: true,
          },
        }),
        options?.signal,
      );
      deleted += page.objects.length;
    }

    return { prefix: scoped, deleted, batches };
  }
}

export function createMinioObjectStorage(
  config: ObjectStorageConfig,
  deps?: MinioObjectStorageDeps,
): MinioObjectStorage {
  return new MinioObjectStorage(config, deps);
}

/** @internal exported for tests that need a real SDK client with a mocked transport. */
export function createMinioS3Client(config: ObjectStorageConfig, endpoint?: string): S3Client {
  const resolved = validateObjectStorageConfig(config);
  return createS3Client(endpoint ?? resolved.endpoint, resolved);
}
