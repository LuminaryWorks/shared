import { describe, expect, test } from "@rstest/core";
import { ObjectStorageError } from "./errors";
import {
  assertKeyProductScope,
  assertListPrefix,
  assertTrialPurgePrefix,
  buildObjectKey,
  isKeyUnderPrefix,
  ownerObjectPrefix,
  parseObjectKey,
  TRIAL_LIFECYCLE_PREFIX,
  trialObjectPrefix,
} from "./keys";

const owner = { kind: "organization" as const, id: "org_1" };

function trialKey(path: string, trialRedemptionId = "tr_abc") {
  return buildObjectKey({
    productCode: "vistaremote",
    billingOwner: owner,
    trialRedemptionId,
    path,
  });
}

function paidKey(path: string, billingOwner = owner) {
  return buildObjectKey({
    productCode: "vistaremote",
    billingOwner,
    path,
  });
}

describe("buildObjectKey path traversal", () => {
  const rejected = [
    "/etc/passwd",
    "\\windows\\system32",
    "C:\\secrets",
    "../etc/passwd",
    "foo/../bar",
    "foo/../../bar",
    "foo//bar",
    "foo/./bar",
    "foo/\u0000bar",
    "foo/\u007Fbar",
    "s3://bucket/key",
    "..",
    ".",
    "",
    "foo/../",
    "%2e%2e/passwd",
    "foo/..%2fbar",
  ];

  for (const path of rejected) {
    test(`rejects ${JSON.stringify(path)}`, () => {
      expect(() => paidKey(path)).toThrow(ObjectStorageError);
    });
  }

  test("rejects empty path array and empty segments", () => {
    expect(() =>
      buildObjectKey({ productCode: "vistaremote", billingOwner: owner, path: [] }),
    ).toThrow(ObjectStorageError);
    expect(() =>
      buildObjectKey({ productCode: "vistaremote", billingOwner: owner, path: ["ok", ""] }),
    ).toThrow(ObjectStorageError);
  });

  test("rejects reserved first segments", () => {
    expect(() => paidKey("trial/escape")).toThrow(/reserved/);
    expect(() => paidKey("obj/escape")).toThrow(/reserved/);
  });

  test("accepts a normal relative recording path under trial/", () => {
    const built = trialKey(["recordings", "session-1.webm"]);
    expect(built.key).toBe("trial/vistaremote/organization/org_1/tr_abc/recordings/session-1.webm");
    expect(built.relativePath).toBe("recordings/session-1.webm");
    expect(built.key.startsWith(TRIAL_LIFECYCLE_PREFIX)).toBe(true);
  });
});

describe("owner isolation", () => {
  test("distinct owners do not share prefixes", () => {
    const a = paidKey("media/a.bin", { kind: "organization", id: "org_1" });
    const b = paidKey("media/a.bin", { kind: "organization", id: "org_10" });
    const c = paidKey("media/a.bin", { kind: "user", id: "org_1" });

    expect(isKeyUnderPrefix(b.key, a.ownerPrefix)).toBe(false);
    expect(isKeyUnderPrefix(a.key, b.ownerPrefix)).toBe(false);
    expect(isKeyUnderPrefix(c.key, a.ownerPrefix)).toBe(false);
    expect(a.ownerPrefix).toBe("obj/vistaremote/organization/org_1/");
    expect(b.ownerPrefix).toBe("obj/vistaremote/organization/org_10/");
    expect(a.key.startsWith(TRIAL_LIFECYCLE_PREFIX)).toBe(false);
  });

  test("product scope rejects another product's key", () => {
    const other = buildObjectKey({
      productCode: "vistacast",
      billingOwner: owner,
      path: "clips/one.webm",
    });
    expect(() => assertKeyProductScope(other.key, "vistaremote")).toThrow(ObjectStorageError);
    expect(assertKeyProductScope(paidKey("clips/one.webm").key, "vistaremote").productCode).toBe(
      "vistaremote",
    );
  });

  test("ownership metadata carries billing owner and product", () => {
    const built = paidKey("files/doc.pdf");
    expect(built.metadata["lw-product-code"]).toBe("vistaremote");
    expect(built.metadata["lw-billing-owner-kind"]).toBe("organization");
    expect(built.metadata["lw-billing-owner-id"]).toBe("org_1");
    expect(built.metadata["lw-trial-redemption-id"]).toBeUndefined();
    expect(built.trialPrefix).toBeUndefined();
  });
});

describe("trial prefix exactness", () => {
  test("purge prefix matches only that redemption id", () => {
    const a = trialKey("recordings/a.webm", "tr_1");
    const sibling = trialKey("recordings/a.webm", "tr_10");
    const paid = paidKey("recordings/a.webm");

    expect(a.trialPrefix).toBe("trial/vistaremote/organization/org_1/tr_1/");
    expect(a.key.startsWith(TRIAL_LIFECYCLE_PREFIX)).toBe(true);
    expect(sibling.key.startsWith(TRIAL_LIFECYCLE_PREFIX)).toBe(true);
    expect(paid.key.startsWith(TRIAL_LIFECYCLE_PREFIX)).toBe(false);
    expect(isKeyUnderPrefix(a.key, a.trialPrefix!)).toBe(true);
    expect(isKeyUnderPrefix(sibling.key, a.trialPrefix!)).toBe(false);
    expect(isKeyUnderPrefix(paid.key, a.trialPrefix!)).toBe(false);
    expect(isKeyUnderPrefix(a.key, TRIAL_LIFECYCLE_PREFIX)).toBe(true);
    expect(isKeyUnderPrefix(paid.key, TRIAL_LIFECYCLE_PREFIX)).toBe(false);
    expect(paid.key.startsWith(a.trialPrefix!.slice(0, -1))).toBe(false);
  });

  test("parseObjectKey round-trips trial and paid keys", () => {
    const trial = trialKey("meta/info.json");
    const paid = paidKey("meta/info.json");
    expect(parseObjectKey(trial.key)).toEqual(trial);
    expect(parseObjectKey(paid.key)).toEqual(paid);
  });

  test("assertTrialPurgePrefix requires the canonical trial root prefix", () => {
    const prefix = trialObjectPrefix({
      productCode: "vistaremote",
      billingOwner: owner,
      trialRedemptionId: "tr_abc",
    });
    expect(prefix).toBe("trial/vistaremote/organization/org_1/tr_abc/");
    expect(assertTrialPurgePrefix(prefix, "vistaremote")).toBe(prefix);

    const rejects = [
      "",
      "/",
      TRIAL_LIFECYCLE_PREFIX,
      "trial/vistaremote/",
      "trial/vistaremote/organization/org_1/",
      "trial/vistaremote/organization/org_1/tr_abc",
      "trial/vistaremote/organization/org_1/tr_abc/recordings/",
      ownerObjectPrefix({ productCode: "vistaremote", billingOwner: owner }),
      "vistaremote/organization/org_1/trial/tr_abc/",
      "vistaremote/organization/org_1/trial/",
      "obj/vistaremote/organization/org_1/",
      "../trial/vistaremote/organization/org_1/tr_abc/",
      "trial/vistacast/organization/org_1/tr_abc/",
    ];
    for (const value of rejects) {
      expect(() => assertTrialPurgePrefix(value, "vistaremote")).toThrow(ObjectStorageError);
    }
  });

  test("list prefix must stay marker-, product-, and owner-scoped", () => {
    expect(() => assertListPrefix("", "vistaremote")).toThrow(ObjectStorageError);
    expect(() => assertListPrefix(TRIAL_LIFECYCLE_PREFIX, "vistaremote")).toThrow(
      ObjectStorageError,
    );
    expect(() => assertListPrefix("obj/", "vistaremote")).toThrow(ObjectStorageError);
    expect(() => assertListPrefix("vistaremote/organization/org_1/", "vistaremote")).toThrow(
      ObjectStorageError,
    );
    expect(assertListPrefix("obj/vistaremote/organization/org_1/", "vistaremote")).toBe(
      "obj/vistaremote/organization/org_1/",
    );
    expect(assertListPrefix("trial/vistaremote/organization/org_1/", "vistaremote")).toBe(
      "trial/vistaremote/organization/org_1/",
    );
  });
});
