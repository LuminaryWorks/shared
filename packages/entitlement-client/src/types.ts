/** Stable error codes — mirror of entitlement service §9.3 */
export const ENTITLEMENT_ERROR_CODES = [
  "ENTITLEMENT_REQUIRED",
  "ENTITLEMENT_TRIAL_EXPIRED",
  "ENTITLEMENT_FEATURE_REQUIRED",
  "ENTITLEMENT_QUOTA_EXCEEDED",
  "ENTITLEMENT_SEAT_EXHAUSTED",
  "ENTITLEMENT_LICENSE_INVALID",
  "ENTITLEMENT_LICENSE_EXPIRED",
  "ENTITLEMENT_SERVICE_UNAVAILABLE",
  "PRODUCT_TRIAL_DISABLED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "CONFLICT",
] as const;

export type EntitlementErrorCode = (typeof ENTITLEMENT_ERROR_CODES)[number];

export const ERROR_HTTP_STATUS: Record<EntitlementErrorCode, number> = {
  ENTITLEMENT_REQUIRED: 402,
  ENTITLEMENT_TRIAL_EXPIRED: 402,
  ENTITLEMENT_FEATURE_REQUIRED: 402,
  ENTITLEMENT_QUOTA_EXCEEDED: 402,
  ENTITLEMENT_SEAT_EXHAUSTED: 402,
  ENTITLEMENT_LICENSE_INVALID: 402,
  ENTITLEMENT_LICENSE_EXPIRED: 402,
  ENTITLEMENT_SERVICE_UNAVAILABLE: 503,
  PRODUCT_TRIAL_DISABLED: 402,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
};

export type EntitlementMode = "off" | "shadow_read" | "enforce";

export type SubjectKind = "USER" | "ORGANIZATION" | "DEPLOYMENT";
export type PlanCode = "trial" | "pro" | "ultra" | "enterprise";
export type TrialPolicy = "standard_7d" | "disabled";

export interface EntitlementErrorBody {
  error: {
    code: EntitlementErrorCode;
    message: string;
    productCode?: string;
    featureCode?: string;
    httpStatus: number;
    details?: Record<string, unknown>;
  };
}

export interface FeatureSnapshot {
  allowed: boolean;
  sources: string[];
  reason?: string;
}

export interface QuotaSnapshot {
  limit: number | null;
  used: number;
  remaining: number | null;
  period: string;
  sources: string[];
}

export interface EntitlementSnapshot {
  productCode: string;
  subjectKind: SubjectKind;
  subjectId: string;
  organizationId: string | null;
  effectivePlan: PlanCode | "none";
  trial: { active: boolean; endsAt: string | null; consumed: boolean; eligible: boolean };
  features: Record<string, FeatureSnapshot>;
  quotas: Record<string, QuotaSnapshot>;
  asOf: string;
}

export interface CatalogPlanFeature {
  featureCode: string;
  effect: "allow" | "deny";
  limitValue: number | null;
  kind: "bool" | "quota";
  quotaPeriod: string | null;
  quotaMerge: "max" | "sum";
}

export interface CatalogPlan {
  code: PlanCode;
  name: string;
  rank: number;
  features: CatalogPlanFeature[];
}

export interface CatalogProductPlans {
  productCode: string;
  productName: string;
  trialPolicy: TrialPolicy;
  plans: CatalogPlan[];
}

export interface CheckItem {
  featureCode: string;
  need?: number;
}

export interface CheckResultItem {
  featureCode: string;
  allowed: boolean;
  reason?: string;
  remaining?: number | null;
}

export interface ConsumeResult {
  featureCode: string;
  consumed: number;
  used: number;
  remaining: number | null;
  limit: number | null;
}

export interface EntitlementClientOptions {
  baseUrl: string;
  mode?: EntitlementMode;
  /** Service M2M key (X-Service-Key). Prefer over forwarding user tokens from product backends. */
  serviceApiKey?: string;
  /** Optional Bearer token supplier (user JWT). */
  getAccessToken?: () => string | Promise<string | undefined> | undefined;
  cacheTtlMs?: number;
  /** Offline grace after a successful central read (ms). 0 = fail closed immediately. */
  offlineGraceMs?: number;
  fetchImpl?: typeof fetch;
  /**
   * Ed25519 public-key ring for private-deployment License local verify (kid → PEM/base64).
   * Never put private keys here. License results feed EntitlementGuard only — Casbin stays on.
   */
  licensePublicKeys?: Record<string, string>;
  /** Called in shadow_read when local vs central differ. */
  onShadowDiff?: (diff: {
    productCode: string;
    subjectId: string;
    local?: unknown;
    central?: EntitlementSnapshot | null;
    error?: unknown;
  }) => void;
  /** Local decision provider used when mode=off or shadow_read. */
  localResolver?: (input: {
    productCode: string;
    subjectId: string;
    organizationId?: string | null;
    featureCode?: string;
  }) => Promise<EntitlementSnapshot | { allowed: boolean; reason?: string } | null>;
}

export const ENTITLEMENT_CLIENT_OPTIONS = Symbol("ENTITLEMENT_CLIENT_OPTIONS");
