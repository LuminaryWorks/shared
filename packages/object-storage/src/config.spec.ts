import { describe, expect, test } from "@rstest/core";
import {
  ABSOLUTE_MAX_PRESIGN_TTL_SECONDS,
  boundPresignTtl,
  type ObjectStorageConfig,
  redactObjectStorageConfig,
  validateObjectStorageConfig,
} from "./config";
import { ObjectStorageError } from "./errors";

const SECRET = "super-secret-value-do-not-leak";

function valid(overrides: Partial<ObjectStorageConfig> = {}): ObjectStorageConfig {
  return {
    endpoint: "http://object-storage:9000",
    publicEndpoint: "https://media.example.com",
    bucket: "vistaremote-recordings",
    productCode: "vistaremote",
    accessKeyId: "vr-access-key",
    secretAccessKey: SECRET,
    ...overrides,
  };
}

describe("validateObjectStorageConfig", () => {
  test("accepts a MinIO-compatible endpoint and defaults path-style", () => {
    const resolved = validateObjectStorageConfig(valid());
    expect(resolved.forcePathStyle).toBe(true);
    expect(resolved.region).toBe("us-east-1");
    expect(resolved.endpoint).toBe("http://object-storage:9000");
    expect(resolved.publicEndpoint).toBe("https://media.example.com");
    expect(resolved.maxPresignTtlSeconds).toBe(900);
  });

  test("rejects missing fields, credentials-in-URL, and public-cloud-style mistakes without hardcoding a provider", () => {
    expect(() => validateObjectStorageConfig(valid({ endpoint: "" }))).toThrow(/endpoint/);
    expect(() => validateObjectStorageConfig(valid({ endpoint: "ftp://storage" }))).toThrow(/http/);
    expect(() =>
      validateObjectStorageConfig(valid({ endpoint: "http://user:pass@object-storage:9000" })),
    ).toThrow(/credentials/);
    expect(() => validateObjectStorageConfig(valid({ bucket: "NotABucket" }))).toThrow(/bucket/);
    expect(() => validateObjectStorageConfig(valid({ productCode: "VistaRemote" }))).toThrow(
      /productCode/,
    );
    expect(() => validateObjectStorageConfig(valid({ accessKeyId: "  " }))).toThrow(/accessKeyId/);
  });

  test("rejects TTL and batch sizes outside the safe bounds", () => {
    expect(() =>
      validateObjectStorageConfig(
        valid({ maxPresignTtlSeconds: ABSOLUTE_MAX_PRESIGN_TTL_SECONDS + 1 }),
      ),
    ).toThrow(/maxPresignTtlSeconds/);
    expect(() => validateObjectStorageConfig(valid({ defaultUploadTtlSeconds: 901 }))).toThrow(
      /defaultUploadTtlSeconds/,
    );
    expect(() => validateObjectStorageConfig(valid({ deletePrefixBatchSize: 1001 }))).toThrow(
      /deletePrefixBatchSize/,
    );
    expect(() => boundPresignTtl(901, 300, 900)).toThrow(ObjectStorageError);
    expect(boundPresignTtl(undefined, 300, 900)).toBe(300);
    expect(boundPresignTtl(60, 300, 900)).toBe(60);
  });
});

describe("redactObjectStorageConfig", () => {
  test("never echoes the secret key", () => {
    const redacted = redactObjectStorageConfig(valid({ sessionToken: "session-token-value" }));
    const json = JSON.stringify(redacted);
    expect(json).not.toContain(SECRET);
    expect(json).not.toContain("session-token-value");
    expect(redacted.secretAccessKey).toBe("[redacted]");
    expect(redacted.sessionToken).toBe("[redacted]");
    expect(String(redacted.accessKeyId)).not.toBe("vr-access-key");
    expect(redacted.endpoint).toBe("http://object-storage:9000");
  });
});
