import type { Readable } from "node:stream";
import type { StorageAdmissionStatus, StorageWriteIntent } from "./admission";
import type { BillingOwner, ObjectOwnershipMetadata } from "./keys";

export interface ObjectContentChecksum {
  /** AWS flexible checksum algorithm. Value is standard base64. */
  algorithm: "SHA256" | "CRC32" | "CRC32C";
  value: string;
}

export interface ObjectWriteOptions {
  contentType?: string;
  contentLength?: number;
  checksum?: ObjectContentChecksum;
  /** Application-level checksum stored in object user-metadata (`lw-content-checksum`). */
  contentChecksum?: string;
  /** Extra user-metadata. Ownership keys are reserved and cannot be overridden. */
  metadata?: Record<string, string>;
  signal?: AbortSignal;
  /** Injected host watermark JSON. Writes fail closed when omitted flags are false. */
  admission?: StorageAdmissionStatus;
  intent?: StorageWriteIntent;
}

export interface ObjectPutInput extends ObjectWriteOptions {
  key: string;
  body: Uint8Array | Buffer | string | Readable;
}

export interface ObjectPutResult {
  key: string;
  eTag?: string;
  checksum?: ObjectContentChecksum;
}

export interface ObjectHeadResult {
  key: string;
  contentType?: string;
  contentLength?: number;
  eTag?: string;
  checksum?: ObjectContentChecksum;
  metadata: Record<string, string>;
  ownership: ObjectOwnershipMetadata;
}

export interface ObjectGetResult extends ObjectHeadResult {
  body: Uint8Array;
}

export interface ObjectDeleteResult {
  key: string;
  deleted: true;
}

export interface ObjectListItem {
  key: string;
  size?: number;
  lastModified?: Date;
  eTag?: string;
}

export interface ObjectListResult {
  prefix: string;
  objects: ObjectListItem[];
  nextCursor?: string;
  truncated: boolean;
}

export interface ObjectListOptions {
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
}

export interface PresignUploadInput extends ObjectWriteOptions {
  key: string;
  expiresInSeconds?: number;
}

export interface PresignDownloadInput {
  key: string;
  expiresInSeconds?: number;
  responseContentType?: string;
  signal?: AbortSignal;
}

export interface PresignResult {
  url: string;
  method: "PUT" | "GET";
  expiresInSeconds: number;
  headers: Record<string, string>;
}

export interface DeletePrefixOptions {
  batchSize?: number;
  signal?: AbortSignal;
}

export interface DeletePrefixResult {
  prefix: string;
  deleted: number;
  batches: number;
}

/**
 * Server-side object storage port. Private buckets only.
 *
 * Browsers may receive short-lived presigned PUT/GET URLs. Never list, delete
 * by prefix, or hand out root / bucket-admin credentials to a browser.
 */
export interface ObjectStoragePort {
  readonly bucket: string;
  readonly productCode: string;

  put(input: ObjectPutInput): Promise<ObjectPutResult>;
  get(key: string, options?: { signal?: AbortSignal }): Promise<ObjectGetResult>;
  head(key: string, options?: { signal?: AbortSignal }): Promise<ObjectHeadResult>;
  delete(key: string, options?: { signal?: AbortSignal }): Promise<ObjectDeleteResult>;
  listPrefix(prefix: string, options?: ObjectListOptions): Promise<ObjectListResult>;
  presignUpload(input: PresignUploadInput): Promise<PresignResult>;
  presignDownload(input: PresignDownloadInput): Promise<PresignResult>;
  deletePrefix(prefix: string, options?: DeletePrefixOptions): Promise<DeletePrefixResult>;
}

export type { BillingOwner, ObjectOwnershipMetadata };
