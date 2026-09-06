import { describe, expect, test } from "@rstest/core";
import { applyEnvOverlay } from "./env";
import type { ControlManifest } from "./types";

function base(): ControlManifest {
  return {
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
}

describe("applyEnvOverlay", () => {
  test("retargets declared service URLs and trims trailing slashes", () => {
    const { manifest, appliedEnvKeys } = applyEnvOverlay(base(), {
      LW_ENTITLEMENT_URL: "https://entitlement.luminaryworks.dev/",
    });
    expect(manifest.services.entitlement?.url).toBe("https://entitlement.luminaryworks.dev");
    expect(appliedEnvKeys).toEqual(["LW_ENTITLEMENT_URL"]);
  });

  test("accepts legacy product env aliases", () => {
    const { manifest } = applyEnvOverlay(base(), {
      IDP_ISSUER: "https://sso.customer.internal/oidc",
      ENTITLEMENT_MODE: "enforce",
    });
    expect(manifest.services.identity?.url).toBe("https://sso.customer.internal/oidc");
    expect(manifest.capabilities.entitlement).toBe("enforce");
  });

  test("prefers LW_* over the legacy alias", () => {
    const { manifest } = applyEnvOverlay(base(), {
      LW_ENTITLEMENT_MODE: "off",
      ENTITLEMENT_MODE: "enforce",
    });
    expect(manifest.capabilities.entitlement).toBe("off");
  });

  test("switches profile, stage and capability modes", () => {
    const { manifest } = applyEnvOverlay(base(), {
      LW_PROFILE: "agent-commerce",
      LW_STAGE: "pilot",
      LW_AI_MODE: "local_byok",
      LW_NOTIFICATION_MODE: "smtp",
    });
    expect(manifest.profile).toBe("agent-commerce");
    expect(manifest.stage).toBe("pilot");
    expect(manifest.capabilities.ai).toBe("local_byok");
    expect(manifest.capabilities.notification).toBe("smtp");
  });

  test("ignores env for services the manifest never declared", () => {
    const { manifest, issues } = applyEnvOverlay(base(), {
      LW_OBSERVABILITY_URL: "http://otel-collector:4318",
    });
    expect(manifest.services.observability).toBeUndefined();
    expect(issues.map((issue) => issue.code)).toContain("env_service_not_declared");
  });

  test("rejects a non-boolean required flag", () => {
    const { issues } = applyEnvOverlay(base(), { LW_ENTITLEMENT_REQUIRED: "sometimes" });
    expect(issues.map((issue) => issue.code)).toContain("env_boolean_invalid");
  });

  test("refuses to degrade AuthN via env", () => {
    const { manifest, issues } = applyEnvOverlay(base(), {
      LW_IDENTITY_DEGRADATION: "fail_open_local",
    });
    expect(issues.map((issue) => issue.code)).toContain("identity_degradation_not_fail_closed");
    expect(manifest.degradation?.identity).toBeUndefined();
  });

  test("warns about secret-like LW_ env keys instead of consuming them", () => {
    const { issues } = applyEnvOverlay(base(), { LW_ENTITLEMENT_SERVICE_API_KEY: "abc123" });
    expect(issues.map((issue) => issue.code)).toContain("secret_like_env_ignored");
  });

  test("leaves the input manifest untouched", () => {
    const original = base();
    applyEnvOverlay(original, { LW_ENTITLEMENT_URL: "http://other:3040" });
    expect(original.services.entitlement?.url).toBe("http://entitlement:3040");
  });
});
