export type ObjectStorageErrorCode =
  | "INVALID_OBJECT_KEY"
  | "INVALID_CONFIG"
  | "OBJECT_NOT_FOUND"
  | "STORAGE_ADMISSION_DENIED"
  | "PRESIGN_TTL_EXCEEDED"
  | "PREFIX_NOT_ALLOWED"
  | "ABORTED"
  | "TRANSPORT_FAILED";

export class ObjectStorageError extends Error {
  readonly code: ObjectStorageErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ObjectStorageErrorCode,
    message: string,
    options?: { cause?: unknown; details?: Record<string, unknown> },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "ObjectStorageError";
    this.code = code;
    this.details = options?.details;
  }
}

export function isObjectStorageError(value: unknown): value is ObjectStorageError {
  return value instanceof ObjectStorageError;
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const reason = signal.reason;
  throw new ObjectStorageError("ABORTED", "Object storage operation aborted", {
    cause: reason instanceof Error ? reason : undefined,
  });
}
