/**
 * Storage admission types matching deploy/object-storage/admission-contract.json.
 *
 * This package never reads host files, Docker sockets, or named volumes.
 * Callers inject the current status (from `object-storage-status.mjs` or an
 * equivalent). Deletes and trial.purge stay allowed even at the 90% watermark.
 */

import { ObjectStorageError } from "./errors";

export const STORAGE_ADMISSION_CONTRACT_VERSION = 1;
export const STORAGE_ADMISSION_AUTHORITY = "aistor-bucket-quota";
export const STORAGE_ADMISSION_BUDGET_BYTES = 128849018880;
export const STORAGE_ADMISSION_BUDGET_LABEL = "120GiB";

export type StorageWriteIntent = "trialRecording" | "trialObjectWrite" | "objectWrite";
export type StorageAdmissionIntent = StorageWriteIntent | "objectDelete";
export type StorageWatermark = "ok" | "70" | "80" | "90";

export interface StorageAdmitFlags {
  trialRecording: boolean;
  trialObjectWrite: boolean;
  objectWrite: boolean;
  objectDelete: boolean;
}

export interface StorageAdmissionWatermarkRule {
  ratio: number;
  admit: StorageAdmitFlags;
  action: string;
}

/** Mirrors admission-contract.json `watermarks` (ratios and admit flags). */
export const STORAGE_ADMISSION_WATERMARKS: Record<
  "70" | "80" | "90",
  StorageAdmissionWatermarkRule
> = {
  "70": {
    ratio: 0.7,
    admit: {
      trialRecording: false,
      trialObjectWrite: true,
      objectWrite: true,
      objectDelete: true,
    },
    action: "stop_new_trial_recording",
  },
  "80": {
    ratio: 0.8,
    admit: {
      trialRecording: false,
      trialObjectWrite: false,
      objectWrite: true,
      objectDelete: true,
    },
    action: "stop_all_trial_object_writes",
  },
  "90": {
    ratio: 0.9,
    admit: {
      trialRecording: false,
      trialObjectWrite: false,
      objectWrite: false,
      objectDelete: true,
    },
    action: "stop_all_non_delete_object_writes",
  },
};

const OPEN_ADMIT: StorageAdmitFlags = {
  trialRecording: true,
  trialObjectWrite: true,
  objectWrite: true,
  objectDelete: true,
};

export interface StorageAdmissionStatus {
  contractVersion?: number;
  authority?: typeof STORAGE_ADMISSION_AUTHORITY | string;
  budgetBytes: number;
  usedBytes: number;
  usedRatio?: number;
  watermark: StorageWatermark;
  admit: StorageAdmitFlags;
  cdnDoesNotReduceDisk?: boolean;
  hardEnforcement?: string;
  action?: string;
}

export function admitFlagsForWatermark(watermark: StorageWatermark): StorageAdmitFlags {
  if (watermark === "ok") return { ...OPEN_ADMIT };
  return { ...STORAGE_ADMISSION_WATERMARKS[watermark].admit };
}

export function evaluateStorageAdmission(
  usedBytes: number,
  budgetBytes = STORAGE_ADMISSION_BUDGET_BYTES,
): StorageAdmissionStatus {
  if (!Number.isFinite(usedBytes) || usedBytes < 0) {
    throw new ObjectStorageError("INVALID_CONFIG", "usedBytes must be a non-negative number");
  }
  if (!Number.isFinite(budgetBytes) || budgetBytes <= 0) {
    throw new ObjectStorageError("INVALID_CONFIG", "budgetBytes must be a positive number");
  }
  const usedRatio = usedBytes / budgetBytes;
  let watermark: StorageWatermark = "ok";
  if (usedRatio >= STORAGE_ADMISSION_WATERMARKS["90"].ratio) watermark = "90";
  else if (usedRatio >= STORAGE_ADMISSION_WATERMARKS["80"].ratio) watermark = "80";
  else if (usedRatio >= STORAGE_ADMISSION_WATERMARKS["70"].ratio) watermark = "70";

  const admit = admitFlagsForWatermark(watermark);
  return {
    contractVersion: STORAGE_ADMISSION_CONTRACT_VERSION,
    authority: STORAGE_ADMISSION_AUTHORITY,
    budgetBytes,
    usedBytes,
    usedRatio,
    watermark,
    admit,
    cdnDoesNotReduceDisk: true,
    hardEnforcement: STORAGE_ADMISSION_AUTHORITY,
    action: watermark === "ok" ? undefined : STORAGE_ADMISSION_WATERMARKS[watermark].action,
  };
}

export function inferWriteIntent(trial: boolean, intent?: StorageWriteIntent): StorageWriteIntent {
  if (intent) return intent;
  return trial ? "trialObjectWrite" : "objectWrite";
}

function flagAllowed(
  admit: StorageAdmitFlags | undefined,
  intent: StorageAdmissionIntent,
): boolean {
  if (intent === "objectDelete") return true;
  if (!admit) return false;
  const flag = admit[intent];
  return flag === true;
}

export function canAdmitStorage(
  status: StorageAdmissionStatus | undefined,
  intent: StorageAdmissionIntent,
): boolean {
  if (intent === "objectDelete") return true;
  if (!status) return false;
  return flagAllowed(status.admit, intent);
}

export function assertStorageAdmission(
  status: StorageAdmissionStatus | undefined,
  intent: StorageAdmissionIntent,
): void {
  if (canAdmitStorage(status, intent)) return;
  const watermark = status?.watermark ?? "unknown";
  const action =
    status?.action ??
    (status && status.watermark !== "ok"
      ? STORAGE_ADMISSION_WATERMARKS[status.watermark]?.action
      : undefined);
  throw new ObjectStorageError(
    "STORAGE_ADMISSION_DENIED",
    `Object write denied at watermark ${watermark}`,
    {
      details: {
        intent,
        watermark,
        action,
        admit: status?.admit,
      },
    },
  );
}
