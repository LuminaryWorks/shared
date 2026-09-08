import { describe, expect, test } from "@rstest/core";
import {
  assertStorageAdmission,
  canAdmitStorage,
  evaluateStorageAdmission,
  STORAGE_ADMISSION_BUDGET_BYTES,
  STORAGE_ADMISSION_WATERMARKS,
} from "./admission";
import { ObjectStorageError } from "./errors";

describe("storage admission matrix", () => {
  test("mirrors 70/80/90 admit flags from the host contract", () => {
    expect(STORAGE_ADMISSION_WATERMARKS["70"].admit).toEqual({
      trialRecording: false,
      trialObjectWrite: true,
      objectWrite: true,
      objectDelete: true,
    });
    expect(STORAGE_ADMISSION_WATERMARKS["80"].admit).toEqual({
      trialRecording: false,
      trialObjectWrite: false,
      objectWrite: true,
      objectDelete: true,
    });
    expect(STORAGE_ADMISSION_WATERMARKS["90"].admit).toEqual({
      trialRecording: false,
      trialObjectWrite: false,
      objectWrite: false,
      objectDelete: true,
    });
  });

  test("below 70% admits all writes", () => {
    const status = evaluateStorageAdmission(0, STORAGE_ADMISSION_BUDGET_BYTES);
    expect(status.watermark).toBe("ok");
    expect(status.cdnDoesNotReduceDisk).toBe(true);
    expect(canAdmitStorage(status, "trialRecording")).toBe(true);
    expect(canAdmitStorage(status, "trialObjectWrite")).toBe(true);
    expect(canAdmitStorage(status, "objectWrite")).toBe(true);
    expect(canAdmitStorage(status, "objectDelete")).toBe(true);
  });

  test("70% stops new trial recording only", () => {
    const used = Math.ceil(STORAGE_ADMISSION_BUDGET_BYTES * 0.7);
    const status = evaluateStorageAdmission(used);
    expect(status.watermark).toBe("70");
    expect(status.action).toBe("stop_new_trial_recording");
    expect(() => assertStorageAdmission(status, "trialRecording")).toThrow(ObjectStorageError);
    assertStorageAdmission(status, "trialObjectWrite");
    assertStorageAdmission(status, "objectWrite");
    assertStorageAdmission(status, "objectDelete");
  });

  test("80% stops all trial object writes", () => {
    const used = Math.ceil(STORAGE_ADMISSION_BUDGET_BYTES * 0.8);
    const status = evaluateStorageAdmission(used);
    expect(status.watermark).toBe("80");
    expect(() => assertStorageAdmission(status, "trialRecording")).toThrow(/watermark 80/);
    expect(() => assertStorageAdmission(status, "trialObjectWrite")).toThrow(ObjectStorageError);
    assertStorageAdmission(status, "objectWrite");
    assertStorageAdmission(status, "objectDelete");
  });

  test("90% stops non-delete writes; deletes always allowed", () => {
    const used = Math.ceil(STORAGE_ADMISSION_BUDGET_BYTES * 0.9);
    const status = evaluateStorageAdmission(used);
    expect(status.watermark).toBe("90");
    expect(() => assertStorageAdmission(status, "objectWrite")).toThrow(ObjectStorageError);
    expect(() => assertStorageAdmission(status, "trialObjectWrite")).toThrow(ObjectStorageError);
    assertStorageAdmission(status, "objectDelete");
    expect(canAdmitStorage(undefined, "objectDelete")).toBe(true);
    expect(canAdmitStorage(undefined, "objectWrite")).toBe(false);
  });

  test("injected status with objectDelete false still allows deletes", () => {
    const status = evaluateStorageAdmission(STORAGE_ADMISSION_BUDGET_BYTES);
    status.admit.objectDelete = false;
    expect(canAdmitStorage(status, "objectDelete")).toBe(true);
    assertStorageAdmission(status, "objectDelete");
  });
});
