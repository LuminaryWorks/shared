import type {
  AiMode,
  CapabilityMaturity,
  ControlProfile,
  ControlServiceName,
  DeploymentStage,
  EntitlementMode,
  IdentityMode,
  NotificationMode,
  ProductCode,
} from "./types";

export const MANIFEST_VERSION = 1 as const;

export const CONTROL_PROFILES: readonly ControlProfile[] = [
  "standalone",
  "control-plane",
  "agent-commerce",
  "smart-site",
  "air-gapped",
];

export const DEPLOYMENT_STAGES: readonly DeploymentStage[] = ["dev", "lab", "pilot", "production"];

/** `pilot` and `production` are the stages where honesty gates bite. */
export const HARDENED_STAGES: readonly DeploymentStage[] = ["pilot", "production"];

export const IDENTITY_MODES: readonly IdentityMode[] = ["central", "external_oidc", "local"];
export const ENTITLEMENT_MODES: readonly EntitlementMode[] = [
  "off",
  "shadow_read",
  "enforce",
  "offline_license",
];
export const AI_MODES: readonly AiMode[] = ["off", "central", "local_byok"];
export const NOTIFICATION_MODES: readonly NotificationMode[] = ["none", "smtp"];

export const CONTROL_SERVICE_NAMES: readonly ControlServiceName[] = [
  "identity",
  "authGateway",
  "entitlement",
  "ai",
  "notification",
  "observability",
];

export const PRODUCT_CODES: readonly ProductCode[] = [
  "dataluminary",
  "blockyedu",
  "doerflow",
  "vistacast",
  "vistaremote",
  "syncrobrain",
];

/**
 * Contract versions this manifest release understands. A consumer refusing an
 * unknown version is intentional: silent version drift is how federated suites
 * break in production.
 */
export const SUPPORTED_CONTRACTS: Readonly<
  Record<ControlServiceName, { apiVersions: readonly string[]; schemaVersions: readonly string[] }>
> = {
  identity: { apiVersions: ["v1"], schemaVersions: ["1"] },
  authGateway: { apiVersions: ["v1"], schemaVersions: ["1"] },
  entitlement: { apiVersions: ["v1"], schemaVersions: ["1"] },
  ai: { apiVersions: ["v1"], schemaVersions: ["1"] },
  notification: { apiVersions: ["v1"], schemaVersions: ["1"] },
  observability: { apiVersions: ["v1"], schemaVersions: ["1"] },
};

/**
 * Which products a scenario profile expects. Scenario packs orchestrate
 * *separate* Compose projects; this is a declaration, not a merge.
 */
export const PROFILE_PRODUCTS: Readonly<Record<ControlProfile, readonly ProductCode[]>> = {
  standalone: [],
  "control-plane": [],
  "agent-commerce": ["vistacast", "syncrobrain", "doerflow"],
  "smart-site": ["vistacast", "syncrobrain", "doerflow", "vistaremote", "dataluminary"],
  "air-gapped": [],
};

/**
 * Products that may be declared by a scenario profile but must never be a
 * production runtime dependency of it.
 */
export const NON_RUNTIME_PRODUCTS: readonly ProductCode[] = ["blockyedu"];

/**
 * Honest maturity of each central capability as implemented today.
 *
 * `ai: central` is deliberately **not** production: the AI Platform service has
 * no AuthN, no Entitlement enforcement and only in-memory metering. Preflight
 * refuses `ai=central` for pilot/production until that changes.
 */
export const CAPABILITY_MATURITY: Readonly<{
  identity: Record<IdentityMode, CapabilityMaturity>;
  entitlement: Record<EntitlementMode, CapabilityMaturity>;
  ai: Record<AiMode, CapabilityMaturity>;
  notification: Record<NotificationMode, CapabilityMaturity>;
}> = {
  identity: { central: "production", external_oidc: "production", local: "lab" },
  entitlement: {
    off: "production",
    shadow_read: "production",
    enforce: "pilot",
    offline_license: "pilot",
  },
  ai: { off: "production", central: "lab", local_byok: "pilot" },
  notification: { none: "production", smtp: "pilot" },
};

/**
 * Gates that must all be true before `ai=central` may enter a hardened stage.
 * Update these flags in the same change that lands the capability — not before.
 */
export const AI_CENTRAL_HARDENING_GATES: Readonly<Record<string, boolean>> = {
  /** AI Platform verifies OIDC/JWT and rejects anonymous callers. */
  authn: false,
  /** AI Platform consults central Entitlement before spending provider quota. */
  entitlement: false,
  /** Usage is metered to durable storage, not process memory. */
  persistentMetering: false,
  /** Provider secrets come from a vault, not request bodies or env dumps. */
  secretVault: false,
  /** `/ready` reflects provider/vault/storage dependencies. */
  readiness: false,
};

export const AI_CENTRAL_HARDENING_BLOCKERS: readonly string[] = Object.entries(
  AI_CENTRAL_HARDENING_GATES,
)
  .filter(([, done]) => !done)
  .map(([gate]) => gate);
