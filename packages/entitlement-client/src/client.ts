import { TtlCache } from "./cache";
import { EntitlementClientError, parseEntitlementError } from "./errors";
import {
  featureAllowed,
  featureLimit,
  type SignedLicense,
  verifySignedLicense,
} from "./license/verify";
import type {
  CheckItem,
  CheckResultItem,
  ConsumeResult,
  EntitlementClientOptions,
  EntitlementMode,
  EntitlementSnapshot,
} from "./types";

export class EntitlementClient {
  private readonly cache: TtlCache<EntitlementSnapshot>;
  private readonly fetchImpl: typeof fetch;
  /** Last successful snapshot per cache key (product:subject:org) — never cross-subject. */
  private readonly lastSuccessByKey = new Map<string, { at: number; snapshot: EntitlementSnapshot }>();

  constructor(private readonly options: EntitlementClientOptions) {
    this.cache = new TtlCache(options.cacheTtlMs ?? 60_000);
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  }

  get mode(): EntitlementMode {
    return this.options.mode ?? "off";
  }

  invalidate(subjectId?: string, productCode?: string): void {
    if (!subjectId && !productCode) {
      this.cache.invalidate();
      this.lastSuccessByKey.clear();
      return;
    }
    const prefix = cacheKey(productCode ?? "", subjectId ?? "");
    this.cache.invalidate(prefix);
    for (const k of this.lastSuccessByKey.keys()) {
      if (k.startsWith(prefix)) this.lastSuccessByKey.delete(k);
    }
  }

  async getEntitlements(input: {
    productCode: string;
    subjectId: string;
    organizationId?: string | null;
    deploymentId?: string | null;
    accessToken?: string;
  }): Promise<EntitlementSnapshot | null> {
    const mode = this.mode;
    if (mode === "off") {
      const local = await this.options.localResolver?.({
        productCode: input.productCode,
        subjectId: input.subjectId,
        organizationId: input.organizationId,
      });
      return (local as EntitlementSnapshot) ?? null;
    }

    const key = cacheKey(input.productCode, input.subjectId, input.organizationId);
    const cached = this.cache.get(key);
    if (cached) return cached;

    try {
      const qs = new URLSearchParams({ productCode: input.productCode });
      if (input.organizationId) qs.set("organizationId", input.organizationId);
      if (input.deploymentId) qs.set("deploymentId", input.deploymentId);
      const snapshot = await this.request<EntitlementSnapshot>(
        `GET`,
        `/v1/entitlements?${qs.toString()}`,
        { actAs: input.subjectId, accessToken: input.accessToken },
      );
      this.cache.set(key, snapshot);
      this.lastSuccessByKey.set(key, { at: Date.now(), snapshot });

      if (mode === "shadow_read") {
        const local = await this.options.localResolver?.({
          productCode: input.productCode,
          subjectId: input.subjectId,
          organizationId: input.organizationId,
        });
        this.options.onShadowDiff?.({
          productCode: input.productCode,
          subjectId: input.subjectId,
          local,
          central: snapshot,
        });
        return (local as EntitlementSnapshot) ?? snapshot;
      }

      return snapshot;
    } catch (error) {
      if (mode === "shadow_read") {
        this.options.onShadowDiff?.({
          productCode: input.productCode,
          subjectId: input.subjectId,
          central: null,
          error,
        });
        const local = await this.options.localResolver?.({
          productCode: input.productCode,
          subjectId: input.subjectId,
          organizationId: input.organizationId,
        });
        return (local as EntitlementSnapshot) ?? null;
      }
      return this.failClosedOrGrace(error, key);
    }
  }

  async check(input: {
    productCode: string;
    subjectId: string;
    features: CheckItem[];
    organizationId?: string | null;
    deploymentId?: string | null;
    accessToken?: string;
  }): Promise<CheckResultItem[]> {
    const mode = this.mode;
    if (mode === "off") {
      return Promise.all(
        input.features.map(async (f) => {
          const local = await this.options.localResolver?.({
            productCode: input.productCode,
            subjectId: input.subjectId,
            organizationId: input.organizationId,
            featureCode: f.featureCode,
          });
          if (local && "allowed" in local) {
            return {
              featureCode: f.featureCode,
              allowed: Boolean(local.allowed),
              reason: local.reason,
            };
          }
          return { featureCode: f.featureCode, allowed: true };
        }),
      );
    }

    try {
      const res = await this.request<{ results: CheckResultItem[] }>("POST", "/v1/entitlements/check", {
        actAs: input.subjectId,
        accessToken: input.accessToken,
        body: {
          productCode: input.productCode,
          organizationId: input.organizationId,
          deploymentId: input.deploymentId,
          features: input.features,
        },
      });
      if (mode === "shadow_read") {
        const localResults = await Promise.all(
          input.features.map(async (f) => {
            const local = await this.options.localResolver?.({
              productCode: input.productCode,
              subjectId: input.subjectId,
              organizationId: input.organizationId,
              featureCode: f.featureCode,
            });
            if (local && "allowed" in local) {
              return {
                featureCode: f.featureCode,
                allowed: Boolean(local.allowed),
                reason: local.reason,
              };
            }
            return { featureCode: f.featureCode, allowed: true };
          }),
        );
        this.options.onShadowDiff?.({
          productCode: input.productCode,
          subjectId: input.subjectId,
          central: null,
          local: { central: res.results, local: localResults },
        });
        return localResults;
      }
      return res.results;
    } catch (error) {
      if (mode === "shadow_read") {
        this.options.onShadowDiff?.({
          productCode: input.productCode,
          subjectId: input.subjectId,
          error,
        });
        return input.features.map((f) => ({ featureCode: f.featureCode, allowed: true }));
      }
      throw this.asUnavailable(error);
    }
  }

  async consume(input: {
    productCode: string;
    subjectId: string;
    featureCode: string;
    amount: number;
    idempotencyKey?: string;
    organizationId?: string | null;
    deploymentId?: string | null;
    accessToken?: string;
  }): Promise<ConsumeResult> {
    if (this.mode === "off") {
      throw new EntitlementClientError(
        "ENTITLEMENT_SERVICE_UNAVAILABLE",
        "Quota consume requires ENTITLEMENT_MODE=enforce (or shadow with central)",
      );
    }
    try {
      const result = await this.request<ConsumeResult>("POST", "/v1/entitlements/consume", {
        actAs: input.subjectId,
        accessToken: input.accessToken,
        headers: input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : undefined,
        body: {
          productCode: input.productCode,
          featureCode: input.featureCode,
          amount: input.amount,
          organizationId: input.organizationId,
          deploymentId: input.deploymentId,
          idempotencyKey: input.idempotencyKey,
        },
      });
      this.invalidate(input.subjectId, input.productCode);
      return result;
    } catch (error) {
      if (this.mode === "shadow_read") {
        this.options.onShadowDiff?.({
          productCode: input.productCode,
          subjectId: input.subjectId,
          error,
        });
      }
      throw this.asUnavailable(error);
    }
  }

  async ensureTrial(input: {
    productCode: string;
    subjectId: string;
    organizationId?: string | null;
    deploymentId?: string | null;
    accessToken?: string;
  }) {
    if (this.mode === "off") return { skipped: true as const, reason: "ENTITLEMENT_MODE=off" };
    return this.request("POST", "/v1/trials/ensure", {
      actAs: input.subjectId,
      accessToken: input.accessToken,
      body: {
        productCode: input.productCode,
        organizationId: input.organizationId,
        deploymentId: input.deploymentId,
      },
    });
  }

  /**
   * Local Ed25519 License verify for private deployments.
   * Returns commercial feature/quota facts only — never authorizes Casbin resource ACL.
   */
  async verifyLicenseLocal(
    license: SignedLicense,
    opts?: {
      productCode?: string;
      featureCode?: string;
      now?: Date;
      /** First install / no prior successful cache: set allowGrace=false. */
      allowGrace?: boolean;
    },
  ) {
    const ring = this.options.licensePublicKeys ?? {};
    const result = verifySignedLicense(license, ring, {
      now: opts?.now,
      requireProduct: opts?.productCode,
      requireFeature: opts?.featureCode,
      allowGrace: opts?.allowGrace,
    });
    if (!result.ok) {
      throw new EntitlementClientError(result.code, result.message);
    }
    return {
      ...result,
      /** Explicit: License ≠ AuthZ bypass */
      casbinBypass: false as const,
      featureAllowed: (productCode: string, featureCode: string) =>
        featureAllowed(result.payload, productCode, featureCode),
      featureLimit: (productCode: string, featureCode: string) =>
        featureLimit(result.payload, productCode, featureCode),
    };
  }

  private failClosedOrGrace(error: unknown, cacheKeyHint: string): EntitlementSnapshot {
    const grace = this.options.offlineGraceMs ?? 0;
    const prior = this.lastSuccessByKey.get(cacheKeyHint);
    if (grace > 0 && prior && Date.now() - prior.at <= grace) {
      return prior.snapshot;
    }
    throw this.asUnavailable(error);
  }

  private asUnavailable(error: unknown): EntitlementClientError {
    if (error instanceof EntitlementClientError) return error;
    return new EntitlementClientError(
      "ENTITLEMENT_SERVICE_UNAVAILABLE",
      error instanceof Error ? error.message : "Entitlement service unavailable",
    );
  }

  private async request<T>(
    method: string,
    path: string,
    opts?: {
      body?: unknown;
      actAs?: string;
      accessToken?: string;
      headers?: Record<string, string>;
    },
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(opts?.headers ?? {}),
    };
    if (opts?.body !== undefined) headers["Content-Type"] = "application/json";

    if (this.options.serviceApiKey) {
      headers["X-Service-Key"] = this.options.serviceApiKey;
      if (opts?.actAs) headers["X-Act-As-Subject"] = opts.actAs;
    } else {
      const token =
        opts?.accessToken ?? (await this.options.getAccessToken?.());
      if (!token) {
        throw new EntitlementClientError("UNAUTHORIZED", "No access token or service key configured");
      }
      headers.Authorization = `Bearer ${token}`;
      if (opts?.actAs) headers["X-Act-As-Subject"] = opts.actAs;
    }

    const url = `${this.options.baseUrl.replace(/\/$/, "")}${path}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method,
        headers,
        body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch (err) {
      throw new EntitlementClientError(
        "ENTITLEMENT_SERVICE_UNAVAILABLE",
        err instanceof Error ? err.message : "Network error",
      );
    }

    const text = await res.text();
    const payload = text ? safeJson(text) : null;
    if (!res.ok) {
      throw parseEntitlementError(payload, res.status);
    }
    return payload as T;
  }
}

function cacheKey(productCode: string, subjectId: string, orgId?: string | null): string {
  return `${productCode}:${subjectId}:${orgId ?? "-"}`;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
