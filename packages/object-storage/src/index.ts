export type {
  StorageAdmissionIntent,
  StorageAdmissionStatus,
  StorageAdmissionWatermarkRule,
  StorageAdmitFlags,
  StorageWatermark,
  StorageWriteIntent,
} from "./admission";
export {
  admitFlagsForWatermark,
  assertStorageAdmission,
  canAdmitStorage,
  evaluateStorageAdmission,
  inferWriteIntent,
  STORAGE_ADMISSION_AUTHORITY,
  STORAGE_ADMISSION_BUDGET_BYTES,
  STORAGE_ADMISSION_BUDGET_LABEL,
  STORAGE_ADMISSION_CONTRACT_VERSION,
  STORAGE_ADMISSION_WATERMARKS,
} from "./admission";
export type { ObjectStorageConfig, ResolvedObjectStorageConfig } from "./config";
export {
  ABSOLUTE_MAX_PRESIGN_TTL_SECONDS,
  boundPresignTtl,
  DEFAULT_DELETE_PREFIX_BATCH_SIZE,
  DEFAULT_MAX_PRESIGN_TTL_SECONDS,
  DEFAULT_PRESIGN_DOWNLOAD_TTL_SECONDS,
  DEFAULT_PRESIGN_UPLOAD_TTL_SECONDS,
  DEFAULT_S3_REGION,
  MAX_DELETE_PREFIX_BATCH_SIZE,
  redactObjectStorageConfig,
  redactSecret,
  validateObjectStorageConfig,
} from "./config";
export type { ObjectStorageErrorCode } from "./errors";
export { isObjectStorageError, ObjectStorageError } from "./errors";
export type {
  BillingOwner,
  BillingOwnerKind,
  BuiltObjectKey,
  ObjectKeyInput,
  ObjectOwnershipMetadata,
} from "./keys";
export {
  assertKeyProductScope,
  assertListPrefix,
  assertSafeSegment,
  assertTrialPurgePrefix,
  buildObjectKey,
  buildOwnershipMetadata,
  isKeyUnderPrefix,
  OWNERSHIP_METADATA_KEYS,
  ownerObjectPrefix,
  PAID_KEY_MARKER,
  parseObjectKey,
  splitRelativePath,
  TRIAL_KEY_MARKER,
  TRIAL_LIFECYCLE_PREFIX,
  trialObjectPrefix,
} from "./keys";
export { createMinioObjectStorage, MinioObjectStorage } from "./minio-adapter";
export type {
  DeletePrefixOptions,
  DeletePrefixResult,
  ObjectContentChecksum,
  ObjectDeleteResult,
  ObjectGetResult,
  ObjectHeadResult,
  ObjectListItem,
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
