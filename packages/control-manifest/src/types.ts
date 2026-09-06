/**
 * Control Manifest types.
 *
 * The manifest is a *static* deployment description: which profile is being
 * deployed, which optional central services exist, which contract versions they
 * speak, and how each capability degrades when a central service is unavailable.
 *
 * The manifest never carries secrets, business resources or dynamic service
 * registration. Products keep their own database, migrations, Casbin policy and
 * release cadence; the manifest only describes the federation wiring.
 */

/** Deployment shapes frozen in `spec/composable-deployment.md`. */
export type ControlProfile =
  | "standalone"
  | "control-plane"
  | "agent-commerce"
  | "smart-site"
  | "air-gapped";

/** Honesty boundary for a deployment. `lab` and `pilot` are never "shipped". */
export type DeploymentStage = "dev" | "lab" | "pilot" | "production";

/** Maturity label for a capability. `stub` must never be sold or metered. */
export type CapabilityMaturity = "production" | "pilot" | "lab" | "stub";

export type IdentityMode = "central" | "external_oidc" | "local";
export type EntitlementMode = "off" | "shadow_read" | "enforce" | "offline_license";
export type AiMode = "off" | "central" | "local_byok";
export type NotificationMode = "none" | "smtp";

export interface ControlCapabilities {
  identity: IdentityMode;
  entitlement: EntitlementMode;
  ai: AiMode;
  notification: NotificationMode;
}

/** Central services that may participate in a composed deployment. */
export type ControlServiceName =
  | "identity"
  | "authGateway"
  | "entitlement"
  | "ai"
  | "notification"
  | "observability";

export interface ControlServiceRef {
  /** Base URL reachable by the consuming plane. No inline credentials. */
  url: string;
  /** `false` means the consumer must still start and degrade as declared. */
  required: boolean;
  /** HTTP surface version, e.g. `v1`. */
  apiVersion: string;
  /** DTO / event payload schema major version, e.g. `1`. */
  schemaVersion: string;
}

export type ProductCode =
  | "dataluminary"
  | "blockyedu"
  | "doerflow"
  | "vistacast"
  | "vistaremote"
  | "syncrobrain";

export interface ProductRef {
  url: string;
  required: boolean;
  apiVersion?: string;
  schemaVersion?: string;
}

/**
 * AuthN never degrades to anonymous: `identity` is pinned to `fail_closed`.
 */
export type IdentityDegradation = "fail_closed";
export type EntitlementDegradation = "fail_closed" | "fail_open_local" | "offline_license";
export type AiDegradation = "fail_closed" | "disable_feature" | "fallback_local_byok";
export type NotificationDegradation = "fail_closed" | "queue" | "drop";

export interface ControlDegradation {
  identity: IdentityDegradation;
  entitlement: EntitlementDegradation;
  ai: AiDegradation;
  notification: NotificationDegradation;
}

export interface ControlManifest {
  manifestVersion: 1;
  profile: ControlProfile;
  stage: DeploymentStage;
  capabilities: ControlCapabilities;
  services: Partial<Record<ControlServiceName, ControlServiceRef>>;
  /** Optional; missing entries are filled by `resolveDegradation`. */
  degradation?: Partial<ControlDegradation>;
  /** Optional product plane endpoints participating in a scenario profile. */
  products?: Partial<Record<ProductCode, ProductRef>>;
}

/** A manifest with degradation fully resolved — what runtime code should consume. */
export interface ResolvedControlManifest extends ControlManifest {
  degradation: ControlDegradation;
}

export type ControlIssueSeverity = "error" | "warning";

export interface ControlIssue {
  severity: ControlIssueSeverity;
  /** Stable machine code, e.g. `secret_like_key`. */
  code: string;
  /** Dotted manifest path, e.g. `services.entitlement.url`. */
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ControlIssue[];
  warnings: ControlIssue[];
}

export interface LoadOptions {
  /** Environment used for the overlay. Defaults to `process.env`. */
  env?: Record<string, string | undefined>;
  /** Skip the environment overlay entirely. */
  applyEnv?: boolean;
}

export interface LoadResult {
  manifest: ResolvedControlManifest;
  warnings: ControlIssue[];
  /** Env keys that changed the manifest, for startup logging. */
  appliedEnvKeys: string[];
}

export interface PreflightResult {
  ok: boolean;
  profile: ControlProfile;
  stage: DeploymentStage;
  errors: ControlIssue[];
  warnings: ControlIssue[];
  /** Central services that must be ready before the plane serves traffic. */
  requiredServices: ControlServiceName[];
  /** Central services allowed to be down; degradation applies. */
  optionalServices: ControlServiceName[];
}
