import { describe, expect, it } from "@rstest/core";
import { TtlCache } from "./cache";
import { EntitlementClient } from "./client";
import { EntitlementClientError, parseEntitlementError } from "./errors";
import { isTrialEligible, supportsTrial } from "./trial";

describe("TtlCache", () => {
  it("stores and invalidates by prefix", () => {
    const cache = new TtlCache<number>(60_000);
    cache.set("vistaremote:user1:-", 1);
    cache.set("vistaremote:user2:-", 2);
    expect(cache.get("vistaremote:user1:-")).toBe(1);
    cache.invalidate("vistaremote:user1");
    expect(cache.get("vistaremote:user1:-")).toBeUndefined();
    expect(cache.get("vistaremote:user2:-")).toBe(2);
  });
});

describe("parseEntitlementError", () => {
  it("preserves stable error DTO", () => {
    const err = parseEntitlementError({
      error: {
        code: "ENTITLEMENT_QUOTA_EXCEEDED",
        message: "Quota exceeded",
        productCode: "vistaremote",
        featureCode: "device.limit",
        httpStatus: 402,
      },
    });
    expect(err).toBeInstanceOf(EntitlementClientError);
    expect(err.code).toBe("ENTITLEMENT_QUOTA_EXCEEDED");
    expect(err.httpStatus).toBe(402);
  });

  it("preserves PRODUCT_TRIAL_DISABLED", () => {
    const err = parseEntitlementError({
      error: {
        code: "PRODUCT_TRIAL_DISABLED",
        message: "Trials are disabled",
        productCode: "doerflow",
        httpStatus: 402,
      },
    });
    expect(err.code).toBe("PRODUCT_TRIAL_DISABLED");
    expect(err.productCode).toBe("doerflow");
  });
});

describe("trial helpers", () => {
  it("maps policy and snapshot eligibility for no-trial products", () => {
    expect(supportsTrial("disabled")).toBe(false);
    expect(supportsTrial("standard_7d")).toBe(true);
    expect(
      isTrialEligible({
        trial: { active: false, endsAt: null, consumed: false, eligible: false },
      }),
    ).toBe(false);
  });
});

describe("EntitlementClient modes", () => {
  it("off mode uses local resolver and skips fetch", async () => {
    let fetched = false;
    const client = new EntitlementClient({
      baseUrl: "http://entitlement.test",
      mode: "off",
      fetchImpl: (async () => {
        fetched = true;
        return new Response("{}");
      }) as typeof fetch,
      localResolver: async () =>
        ({
          productCode: "dataluminary",
          subjectKind: "USER",
          subjectId: "u1",
          organizationId: null,
          effectivePlan: "pro",
          trial: { active: false, endsAt: null, consumed: true, eligible: false },
          features: {},
          quotas: {},
          asOf: new Date().toISOString(),
        }) as const,
    });
    const snap = await client.getEntitlements({ productCode: "dataluminary", subjectId: "u1" });
    expect(snap?.effectivePlan).toBe("pro");
    expect(fetched).toBe(false);
  });

  it("enforce mode fail-closes on network error", async () => {
    const client = new EntitlementClient({
      baseUrl: "http://entitlement.test",
      mode: "enforce",
      serviceApiKey: "k",
      fetchImpl: (async () => {
        throw new Error("offline");
      }) as typeof fetch,
    });
    await expect(
      client.getEntitlements({ productCode: "dataluminary", subjectId: "u1" }),
    ).rejects.toMatchObject({ code: "ENTITLEMENT_SERVICE_UNAVAILABLE" });
  });

  it("offline grace never returns another subject's snapshot", async () => {
    const snap = (subjectId: string) =>
      ({
        productCode: "dataluminary",
        subjectKind: "USER" as const,
        subjectId,
        organizationId: null,
        effectivePlan: "pro" as const,
        trial: { active: false, endsAt: null, consumed: true, eligible: false },
        features: {},
        quotas: {},
        asOf: new Date().toISOString(),
      }) as const;

    let calls = 0;
    const client = new EntitlementClient({
      baseUrl: "http://entitlement.test",
      mode: "enforce",
      serviceApiKey: "k",
      offlineGraceMs: 60_000,
      fetchImpl: (async () => {
        calls += 1;
        if (calls === 1) {
          return new Response(JSON.stringify(snap("user-a")), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        throw new Error("offline");
      }) as typeof fetch,
    });

    const a = await client.getEntitlements({ productCode: "dataluminary", subjectId: "user-a" });
    expect(a?.subjectId).toBe("user-a");
    await expect(
      client.getEntitlements({ productCode: "dataluminary", subjectId: "user-b" }),
    ).rejects.toMatchObject({ code: "ENTITLEMENT_SERVICE_UNAVAILABLE" });
  });
});
