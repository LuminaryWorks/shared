import { ObjectStorageError } from "./errors";
import { normalizeProductCode } from "./keys";

function requireProductCode(value: string): string {
  try {
    return normalizeProductCode(value);
  } catch (err) {
    if (err instanceof ObjectStorageError) {
      throw new ObjectStorageError(
        "INVALID_CONFIG",
        "productCode must be a lowercase kebab-case identifier",
      );
    }
    throw err;
  }
}

/** SigV4 region label required by the AWS SDK. Not a public-cloud region assumption. */
export const DEFAULT_S3_REGION = "us-east-1";

export const DEFAULT_PRESIGN_UPLOAD_TTL_SECONDS = 300;
export const DEFAULT_PRESIGN_DOWNLOAD_TTL_SECONDS = 600;
export const DEFAULT_MAX_PRESIGN_TTL_SECONDS = 900;
/** Hard ceiling — operators may lower `maxPresignTtlSeconds`, never raise past this. */
export const ABSOLUTE_MAX_PRESIGN_TTL_SECONDS = 3600;
export const DEFAULT_DELETE_PREFIX_BATCH_SIZE = 100;
export const MAX_DELETE_PREFIX_BATCH_SIZE = 1000;

export interface ObjectStorageConfig {
  /** Internal MinIO-compatible API (e.g. `http://object-storage:9000`). */
  endpoint: string;
  /**
   * Public / CDN origin used only when signing PUT/GET URLs for browsers.
   * Data-plane put/get/delete/head/list always use `endpoint`.
   */
  publicEndpoint?: string;
  /** SigV4 region label. MinIO ignores AWS region topology; default `us-east-1`. */
  region?: string;
  /** Path-style addressing. Default true for MinIO-compatible servers. */
  forcePathStyle?: boolean;
  bucket: string;
  productCode: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  /** Inclusive max TTL for presigned PUT/GET. Default 900, hard max 3600. */
  maxPresignTtlSeconds?: number;
  defaultUploadTtlSeconds?: number;
  defaultDownloadTtlSeconds?: number;
  /** Keys per DeleteObjects batch for trial purge. Default 100, max 1000. */
  deletePrefixBatchSize?: number;
}

export interface ResolvedObjectStorageConfig {
  endpoint: string;
  publicEndpoint?: string;
  region: string;
  forcePathStyle: true | boolean;
  bucket: string;
  productCode: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  maxPresignTtlSeconds: number;
  defaultUploadTtlSeconds: number;
  defaultDownloadTtlSeconds: number;
  deletePrefixBatchSize: number;
}

const BUCKET_RE = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

function requireNonEmpty(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ObjectStorageError("INVALID_CONFIG", `${field} is required`);
  }
  return value.trim();
}

function parseEndpoint(value: string, field: string): string {
  const raw = requireNonEmpty(value, field);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ObjectStorageError("INVALID_CONFIG", `${field} must be an absolute http(s) URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ObjectStorageError("INVALID_CONFIG", `${field} must use http or https`);
  }
  if (url.username || url.password) {
    throw new ObjectStorageError(
      "INVALID_CONFIG",
      `${field} must not embed credentials in the URL`,
    );
  }
  return raw.replace(/\/+$/, "");
}

function optionalPositiveInt(value: number | undefined, field: string, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value <= 0) {
    throw new ObjectStorageError("INVALID_CONFIG", `${field} must be a positive integer`);
  }
  return value;
}

export function validateObjectStorageConfig(
  input: ObjectStorageConfig,
): ResolvedObjectStorageConfig {
  const endpoint = parseEndpoint(input.endpoint, "endpoint");
  const publicEndpoint = input.publicEndpoint
    ? parseEndpoint(input.publicEndpoint, "publicEndpoint")
    : undefined;
  const bucket = requireNonEmpty(input.bucket, "bucket");
  if (!BUCKET_RE.test(bucket) || bucket.includes("..") || bucket.includes("/")) {
    throw new ObjectStorageError("INVALID_CONFIG", "bucket is not a valid S3 bucket name");
  }
  const productCode = requireProductCode(input.productCode);
  const accessKeyId = requireNonEmpty(input.accessKeyId, "accessKeyId");
  const secretAccessKey = requireNonEmpty(input.secretAccessKey, "secretAccessKey");
  if (input.sessionToken !== undefined) {
    requireNonEmpty(input.sessionToken, "sessionToken");
  }

  const maxPresignTtlSeconds = optionalPositiveInt(
    input.maxPresignTtlSeconds,
    "maxPresignTtlSeconds",
    DEFAULT_MAX_PRESIGN_TTL_SECONDS,
  );
  if (maxPresignTtlSeconds > ABSOLUTE_MAX_PRESIGN_TTL_SECONDS) {
    throw new ObjectStorageError(
      "INVALID_CONFIG",
      `maxPresignTtlSeconds must be <= ${ABSOLUTE_MAX_PRESIGN_TTL_SECONDS}`,
    );
  }

  const defaultUploadTtlSeconds = optionalPositiveInt(
    input.defaultUploadTtlSeconds,
    "defaultUploadTtlSeconds",
    DEFAULT_PRESIGN_UPLOAD_TTL_SECONDS,
  );
  const defaultDownloadTtlSeconds = optionalPositiveInt(
    input.defaultDownloadTtlSeconds,
    "defaultDownloadTtlSeconds",
    DEFAULT_PRESIGN_DOWNLOAD_TTL_SECONDS,
  );
  if (defaultUploadTtlSeconds > maxPresignTtlSeconds) {
    throw new ObjectStorageError(
      "INVALID_CONFIG",
      "defaultUploadTtlSeconds exceeds maxPresignTtlSeconds",
    );
  }
  if (defaultDownloadTtlSeconds > maxPresignTtlSeconds) {
    throw new ObjectStorageError(
      "INVALID_CONFIG",
      "defaultDownloadTtlSeconds exceeds maxPresignTtlSeconds",
    );
  }

  const deletePrefixBatchSize = optionalPositiveInt(
    input.deletePrefixBatchSize,
    "deletePrefixBatchSize",
    DEFAULT_DELETE_PREFIX_BATCH_SIZE,
  );
  if (deletePrefixBatchSize > MAX_DELETE_PREFIX_BATCH_SIZE) {
    throw new ObjectStorageError(
      "INVALID_CONFIG",
      `deletePrefixBatchSize must be <= ${MAX_DELETE_PREFIX_BATCH_SIZE}`,
    );
  }

  return {
    endpoint,
    publicEndpoint,
    region: input.region?.trim() ? input.region.trim() : DEFAULT_S3_REGION,
    forcePathStyle: input.forcePathStyle !== false,
    bucket,
    productCode,
    accessKeyId,
    secretAccessKey,
    sessionToken: input.sessionToken?.trim() || undefined,
    maxPresignTtlSeconds,
    defaultUploadTtlSeconds,
    defaultDownloadTtlSeconds,
    deletePrefixBatchSize,
  };
}

export function redactSecret(value: string | undefined): string {
  if (!value) return "[redacted]";
  if (value.length <= 4) return "[redacted]";
  return `${value.slice(0, 2)}…${value.slice(-2)}`;
}

export function redactObjectStorageConfig(
  config: ObjectStorageConfig | ResolvedObjectStorageConfig,
): Record<string, unknown> {
  return {
    endpoint: config.endpoint,
    publicEndpoint: config.publicEndpoint,
    region: "region" in config && config.region ? config.region : DEFAULT_S3_REGION,
    forcePathStyle: config.forcePathStyle !== false,
    bucket: config.bucket,
    productCode: config.productCode,
    accessKeyId: redactSecret(config.accessKeyId),
    secretAccessKey: "[redacted]",
    sessionToken: config.sessionToken ? "[redacted]" : undefined,
    maxPresignTtlSeconds:
      "maxPresignTtlSeconds" in config
        ? config.maxPresignTtlSeconds
        : DEFAULT_MAX_PRESIGN_TTL_SECONDS,
    defaultUploadTtlSeconds:
      "defaultUploadTtlSeconds" in config
        ? config.defaultUploadTtlSeconds
        : DEFAULT_PRESIGN_UPLOAD_TTL_SECONDS,
    defaultDownloadTtlSeconds:
      "defaultDownloadTtlSeconds" in config
        ? config.defaultDownloadTtlSeconds
        : DEFAULT_PRESIGN_DOWNLOAD_TTL_SECONDS,
    deletePrefixBatchSize:
      "deletePrefixBatchSize" in config
        ? config.deletePrefixBatchSize
        : DEFAULT_DELETE_PREFIX_BATCH_SIZE,
  };
}

export function boundPresignTtl(
  requested: number | undefined,
  fallback: number,
  maxPresignTtlSeconds: number,
): number {
  const ttl = requested === undefined ? fallback : requested;
  if (!Number.isInteger(ttl) || ttl <= 0) {
    throw new ObjectStorageError(
      "INVALID_CONFIG",
      "presign TTL must be a positive integer (seconds)",
    );
  }
  if (ttl > maxPresignTtlSeconds) {
    throw new ObjectStorageError(
      "PRESIGN_TTL_EXCEEDED",
      `presign TTL ${ttl}s exceeds max ${maxPresignTtlSeconds}s`,
      { details: { requested: ttl, maxPresignTtlSeconds } },
    );
  }
  return ttl;
}
