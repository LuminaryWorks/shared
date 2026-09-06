import { describe, expect, test } from "@rstest/core";
import type { ControlManifest } from "./types";
import { resolveDegradation, validateControlManifest } from "./validate";

function controlPlane(overrides: Partial<ControlManifest> = {}): ControlManifest {
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
    ...overrides,
  };
}

function codes(issues: { code: string }[]): string[] {
  return issues.map((issue) => issue.code);
}

describe("shape", () => {
  test("accepts a minimal control-plane manifest", () => {
    const result = validateControlManifest(controlPlane());
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test("rejects a non-object manifest", () => {
    expect(codes(validateControlManifest("nope").errors)).toContain("manifest_not_object");
  });

  test("rejects unknown profile, stage and capability modes", () => {
    const result = validateControlManifest({
      manifestVersion: 1,
      profile: "everything",
      stage: "someday",
      capabilities: { identity: "magic", entitlement: "maybe", ai: "yes", notification: "sms" },
      services: {},
    });
    expect(codes(result.errors)).toEqual(
      expect.arrayContaining([
        "profile_unknown",
        "stage_unknown",
        "identity_mode_unknown",
        "entitlement_mode_unknown",
        "ai_mode_unknown",
        "notification_mode_unknown",
      ]),
    );
  });

  test("rejects an unsupported manifestVersion", () => {
    expect(codes(validateControlManifest(controlPlane({ manifestVersion: 2 as 1 })).errors)).toContain(
      "manifest_version_unsupported",
    );
  });

  test("rejects an unknown service — the manifest is not a service registry", () => {
    const manifest = controlPlane();
    (manifest.services as Record<string, unknown>).billing = {
      url: "http://billing:9000",
      required: false,
      apiVersion: "v1",
      schemaVersion: "1",
    };
    expect(codes(validateControlManifest(manifest).errors)).toContain("service_unknown");
  });

  test("requires an explicit required flag on every service", () => {
    const manifest = controlPlane();
    delete (manifest.services.entitlement as { required?: boolean }).required;
    expect(codes(validateControlManifest(manifest).errors)).toContain("service_required_missing");
  });
});

describe("contract versions", () => {
  test("rejects unsupported apiVersion and schemaVersion", () => {
    const manifest = controlPlane();
    manifest.services.entitlement = {
      url: "http://entitlement:3040",
      required: false,
      apiVersion: "v9",
      schemaVersion: "42",
    };
    expect(codes(validateControlManifest(manifest).errors)).toEqual(
      expect.arrayContaining(["api_version_unsupported", "schema_version_unsupported"]),
    );
  });
});

describe("secrets", () => {
  test("rejects secret-like keys anywhere in the document", () => {
    const manifest = controlPlane() as unknown as Record<string, unknown>;
    (manifest.services as Record<string, Record<string, unknown>>).entitlement.serviceApiKey =
      "abc";
    expect(codes(validateControlManifest(manifest).errors)).toContain("secret_like_key");
  });

  test("rejects inline URL credentials", () => {
    const manifest = controlPlane();
    manifest.services.entitlement = {
      url: "http://user:hunter2@entitlement:3040",
      required: false,
      apiVersion: "v1",
      schemaVersion: "1",
    };
    expect(codes(validateControlManifest(manifest).errors)).toContain("inline_url_credentials");
  });
});

describe("urls", () => {
  test("rejects host.docker.internal in every stage", () => {
    const manifest = controlPlane();
    manifest.services.identity.url = "http://host.docker.internal:3001/oidc";
    expect(codes(validateControlManifest(manifest).errors)).toContain("host_docker_internal");
  });

  test("rejects loopback and plaintext external hosts in production", () => {
    const manifest = controlPlane({ stage: "production" });
    manifest.services.identity.url = "http://localhost:3001/oidc";
    manifest.services.entitlement = {
      url: "http://entitlement.example.com",
      required: false,
      apiVersion: "v1",
      schemaVersion: "1",
    };
    expect(codes(validateControlManifest(manifest).errors)).toEqual(
      expect.arrayContaining(["loopback_in_hardened_stage", "plaintext_external_url"]),
    );
  });

  test("allows plaintext internal DNS names in production", () => {
    const manifest = controlPlane({ stage: "production" });
    manifest.services.identity.url = "http://identity.luminary-control.internal/oidc";
    const result = validateControlManifest(manifest);
    expect(codes(result.errors)).not.toContain("plaintext_external_url");
  });
});

describe("identity wiring", () => {
  test("central identity requires a declared identity service", () => {
    const manifest = controlPlane();
    delete (manifest.services as Record<string, unknown>).identity;
    expect(codes(validateControlManifest(manifest).errors)).toContain("identity_service_missing");
  });

  test("AuthN must never be optional", () => {
    const manifest = controlPlane();
    manifest.services.identity.required = false;
    expect(codes(validateControlManifest(manifest).errors)).toContain("identity_service_optional");
  });

  test("identity degradation other than fail_closed is rejected", () => {
    const manifest = controlPlane({
      degradation: { identity: "fail_open_local" as never },
    });
    expect(codes(validateControlManifest(manifest).errors)).toContain(
      "identity_degradation_not_fail_closed",
    );
  });

  test("identity=local is lab-only outside air-gapped", () => {
    const manifest = controlPlane({
      profile: "standalone",
      stage: "production",
      capabilities: {
        identity: "local",
        entitlement: "off",
        ai: "off",
        notification: "none",
      },
      services: {},
    });
    expect(codes(validateControlManifest(manifest).errors)).toContain(
      "identity_local_not_hardened",
    );
  });
});

describe("entitlement wiring", () => {
  test("enforce requires an authoritative central service", () => {
    const manifest = controlPlane({
      capabilities: {
        identity: "central",
        entitlement: "enforce",
        ai: "off",
        notification: "none",
      },
    });
    expect(codes(validateControlManifest(manifest).errors)).toContain(
      "entitlement_enforce_optional",
    );
  });

  test("enforce with fail_open_local is rejected in production", () => {
    const manifest = controlPlane({
      stage: "production",
      capabilities: {
        identity: "central",
        entitlement: "enforce",
        ai: "off",
        notification: "none",
      },
      services: {
        identity: {
          url: "https://id.luminaryworks.dev/oidc",
          required: true,
          apiVersion: "v1",
          schemaVersion: "1",
        },
        entitlement: {
          url: "https://entitlement.luminaryworks.dev",
          required: true,
          apiVersion: "v1",
          schemaVersion: "1",
        },
      },
      degradation: { entitlement: "fail_open_local" },
    });
    expect(codes(validateControlManifest(manifest).errors)).toContain(
      "entitlement_fail_open_in_hardened_stage",
    );
  });

  test("offline_license must not hard-depend on the central service", () => {
    const manifest = controlPlane({
      profile: "air-gapped",
      capabilities: {
        identity: "external_oidc",
        entitlement: "offline_license",
        ai: "local_byok",
        notification: "none",
      },
      services: {
        identity: {
          url: "https://sso.customer.internal/oidc",
          required: true,
          apiVersion: "v1",
          schemaVersion: "1",
        },
        entitlement: {
          url: "http://entitlement:3040",
          required: true,
          apiVersion: "v1",
          schemaVersion: "1",
        },
      },
      degradation: { entitlement: "offline_license" },
    });
    expect(codes(validateControlManifest(manifest).errors)).toContain(
      "offline_license_requires_no_service",
    );
  });
});

describe("ai gate", () => {
  test("ai=central is allowed in dev", () => {
    const manifest = controlPlane({
      capabilities: {
        identity: "central",
        entitlement: "shadow_read",
        ai: "central",
        notification: "none",
      },
    });
    manifest.services.ai = {
      url: "http://ai-platform:13100",
      required: false,
      apiVersion: "v1",
      schemaVersion: "1",
    };
    expect(validateControlManifest(manifest).ok).toBe(true);
  });

  test("ai=central is rejected for pilot and production", () => {
    for (const stage of ["pilot", "production"] as const) {
      const manifest = controlPlane({
        stage,
        capabilities: {
          identity: "central",
          entitlement: "shadow_read",
          ai: "central",
          notification: "none",
        },
        services: {
          identity: {
            url: "https://id.luminaryworks.dev/oidc",
            required: true,
            apiVersion: "v1",
            schemaVersion: "1",
          },
          entitlement: {
            url: "https://entitlement.luminaryworks.dev",
            required: false,
            apiVersion: "v1",
            schemaVersion: "1",
          },
          ai: {
            url: "https://ai.luminaryworks.dev",
            required: false,
            apiVersion: "v1",
            schemaVersion: "1",
          },
        },
      });
      const result = validateControlManifest(manifest);
      expect(codes(result.errors)).toEqual(
        expect.arrayContaining(["ai_central_not_hardened", "capability_not_ready_for_stage"]),
      );
    }
  });

  test("ai=off|local_byok pass the production gate", () => {
    for (const ai of ["off", "local_byok"] as const) {
      const manifest = controlPlane({
        stage: "production",
        capabilities: {
          identity: "central",
          entitlement: "shadow_read",
          ai,
          notification: "none",
        },
        services: {
          identity: {
            url: "https://id.luminaryworks.dev/oidc",
            required: true,
            apiVersion: "v1",
            schemaVersion: "1",
          },
          entitlement: {
            url: "https://entitlement.luminaryworks.dev",
            required: false,
            apiVersion: "v1",
            schemaVersion: "1",
          },
        },
      });
      expect(validateControlManifest(manifest).errors).toEqual([]);
    }
  });

  test("ai=off cannot fall back to local BYOK", () => {
    const manifest = controlPlane({ degradation: { ai: "fallback_local_byok" } });
    expect(codes(validateControlManifest(manifest).errors)).toContain("ai_off_with_byok_fallback");
  });

  test("services.ai must not be required unless ai=central", () => {
    const manifest = controlPlane();
    manifest.services.ai = {
      url: "http://ai-platform:13100",
      required: true,
      apiVersion: "v1",
      schemaVersion: "1",
    };
    expect(codes(validateControlManifest(manifest).errors)).toContain(
      "ai_service_required_without_central",
    );
  });
});

describe("scenario profiles", () => {
  const scenarioServices = {
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
  };

  test("agent-commerce requires its three product planes", () => {
    const result = validateControlManifest({
      manifestVersion: 1,
      profile: "agent-commerce",
      stage: "dev",
      capabilities: {
        identity: "central",
        entitlement: "shadow_read",
        ai: "off",
        notification: "none",
      },
      services: scenarioServices,
      products: {
        vistacast: { url: "http://vistacast-api:18080", required: true },
      },
    });
    const missing = result.errors.filter((issue) => issue.code === "profile_product_missing");
    expect(missing.map((issue) => issue.path)).toEqual([
      "products.syncrobrain",
      "products.doerflow",
    ]);
  });

  test("smart-site accepts the full set and keeps BlockyEdu non-runtime", () => {
    const result = validateControlManifest({
      manifestVersion: 1,
      profile: "smart-site",
      stage: "dev",
      capabilities: {
        identity: "central",
        entitlement: "shadow_read",
        ai: "off",
        notification: "none",
      },
      services: scenarioServices,
      products: {
        vistacast: { url: "http://vistacast-api:18080", required: true },
        syncrobrain: { url: "http://syncrobrain-api:8080", required: true },
        doerflow: { url: "http://doerflow-api:3000", required: true },
        vistaremote: { url: "http://vistaremote-api:13010", required: true },
        dataluminary: { url: "http://datatalk-api:13011", required: false },
        blockyedu: { url: "http://blockyedu-api:18081", required: false },
      },
    });
    expect(result.errors).toEqual([]);
  });

  test("BlockyEdu must not be a required runtime dependency", () => {
    const result = validateControlManifest({
      manifestVersion: 1,
      profile: "standalone",
      stage: "dev",
      capabilities: {
        identity: "central",
        entitlement: "off",
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
      },
      products: { blockyedu: { url: "http://blockyedu-api:18081", required: true } },
    });
    expect(codes(result.errors)).toContain("non_runtime_product_required");
  });

  test("air-gapped rejects central AI and central Entitlement", () => {
    const result = validateControlManifest({
      manifestVersion: 1,
      profile: "air-gapped",
      stage: "production",
      capabilities: {
        identity: "external_oidc",
        entitlement: "enforce",
        ai: "central",
        notification: "smtp",
      },
      services: {
        identity: {
          url: "https://sso.customer.internal/oidc",
          required: true,
          apiVersion: "v1",
          schemaVersion: "1",
        },
        entitlement: {
          url: "https://entitlement.luminaryworks.dev",
          required: true,
          apiVersion: "v1",
          schemaVersion: "1",
        },
        ai: {
          url: "https://ai.luminaryworks.dev",
          required: false,
          apiVersion: "v1",
          schemaVersion: "1",
        },
      },
    });
    expect(codes(result.errors)).toEqual(
      expect.arrayContaining(["air_gapped_central_ai", "air_gapped_central_entitlement"]),
    );
  });
});

describe("degradation defaults", () => {
  test("identity is always fail_closed", () => {
    expect(resolveDegradation(controlPlane()).identity).toBe("fail_closed");
  });

  test("offline_license defaults to offline_license degradation", () => {
    const resolved = resolveDegradation(
      controlPlane({
        capabilities: {
          identity: "external_oidc",
          entitlement: "offline_license",
          ai: "off",
          notification: "none",
        },
      }),
    );
    expect(resolved.entitlement).toBe("offline_license");
  });

  test("local BYOK defaults to falling back to local BYOK", () => {
    const resolved = resolveDegradation(
      controlPlane({
        capabilities: {
          identity: "central",
          entitlement: "off",
          ai: "local_byok",
          notification: "none",
        },
      }),
    );
    expect(resolved.ai).toBe("fallback_local_byok");
  });
});
