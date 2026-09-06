import { describe, expect, test } from "@rstest/core";
import {
  ControlManifestError,
  inspectControlManifest,
  loadControlManifest,
} from "./parse";
import { describeAiCentralGate, preflightControlManifest } from "./preflight";
import type { ControlManifest } from "./types";

const MANIFEST: ControlManifest = {
  manifestVersion: 1,
  profile: "control-plane",
  stage: "dev",
  capabilities: {
    identity: "central",
    entitlement: "shadow_read",
    ai: "off",
    notification: "none",
  },
  services: {
    identity: {
      url: "http://identity:3001/oidc",
      required: true,
      apiVersion: "v1",
      schemaVersion: "1",
    },
    entitlement: {
      url: "http://entitlement:3040",
      required: false,
      apiVersion: "v1",
      schemaVersion: "1",
    },
  },
};

const JSON_TEXT = JSON.stringify(MANIFEST);

describe("loadControlManifest", () => {
  test("parses JSON text and resolves degradation", () => {
    const { manifest } = loadControlManifest(JSON_TEXT, { env: {} });
    expect(manifest.degradation).toEqual({
      identity: "fail_closed",
      entitlement: "fail_closed",
      ai: "disable_feature",
      notification: "drop",
    });
  });

  test("tolerates a UTF-8 BOM but keeps JSON errors explicit", () => {
    expect(() => loadControlManifest(`\uFEFF${JSON_TEXT}`, { env: {} })).not.toThrow();
    try {
      loadControlManifest("{ not json", { env: {} });
      throw new Error("expected a ControlManifestError");
    } catch (err) {
      expect(err).toBeInstanceOf(ControlManifestError);
      expect((err as ControlManifestError).issues[0]?.code).toBe("manifest_not_json");
    }
  });

  test("applies the env overlay before validating", () => {
    const { manifest, appliedEnvKeys } = loadControlManifest(JSON_TEXT, {
      env: { LW_ENTITLEMENT_URL: "http://entitlement.luminary-control.internal:3040" },
    });
    expect(manifest.services.entitlement?.url).toBe(
      "http://entitlement.luminary-control.internal:3040",
    );
    expect(appliedEnvKeys).toEqual(["LW_ENTITLEMENT_URL"]);
  });

  test("skips the overlay when applyEnv is false", () => {
    const { manifest, appliedEnvKeys } = loadControlManifest(JSON_TEXT, {
      applyEnv: false,
      env: { LW_STAGE: "production" },
    });
    expect(manifest.stage).toBe("dev");
    expect(appliedEnvKeys).toEqual([]);
  });

  test("throws when the env overlay makes the deployment invalid", () => {
    expect(() =>
      loadControlManifest(JSON_TEXT, { env: { LW_STAGE: "production", LW_AI_MODE: "central" } }),
    ).toThrow(ControlManifestError);
  });
});

describe("inspectControlManifest", () => {
  test("reports every issue instead of failing fast", () => {
    const { result } = inspectControlManifest(
      { manifestVersion: 1, profile: "nope", stage: "nope", capabilities: {}, services: {} },
      { env: {} },
    );
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(3);
  });
});

describe("preflightControlManifest", () => {
  test("splits required and optional central services", () => {
    const report = preflightControlManifest(JSON_TEXT, { env: {} });
    expect(report.ok).toBe(true);
    expect(report.requiredServices).toEqual(["identity"]);
    expect(report.optionalServices).toEqual(["entitlement"]);
  });

  test("refuses ai=central for a production profile", () => {
    const report = preflightControlManifest(
      { ...MANIFEST, stage: "production" },
      { env: { LW_AI_MODE: "central" } },
    );
    expect(report.ok).toBe(false);
    expect(report.errors.map((issue) => issue.code)).toContain("ai_central_not_hardened");
  });
});

describe("describeAiCentralGate", () => {
  test("reports the AI Platform as not hardened yet", () => {
    const gate = describeAiCentralGate();
    expect(gate.hardened).toBe(false);
    expect(gate.blockers).toEqual(
      expect.arrayContaining(["authn", "entitlement", "persistentMetering"]),
    );
  });
});
