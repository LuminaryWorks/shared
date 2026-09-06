import {
  AI_CENTRAL_HARDENING_BLOCKERS,
  AI_MODES,
  CAPABILITY_MATURITY,
  CONTROL_PROFILES,
  CONTROL_SERVICE_NAMES,
  DEPLOYMENT_STAGES,
  ENTITLEMENT_MODES,
  HARDENED_STAGES,
  IDENTITY_MODES,
  MANIFEST_VERSION,
  NON_RUNTIME_PRODUCTS,
  NOTIFICATION_MODES,
  PRODUCT_CODES,
  PROFILE_PRODUCTS,
} from "./constants";
import { scanForSecrets } from "./secrets";
import type {
  CapabilityMaturity,
  ControlDegradation,
  ControlIssue,
  ControlManifest,
  ControlProfile,
  ControlServiceName,
  DeploymentStage,
  ProductCode,
  ResolvedControlManifest,
  ValidationResult,
} from "./types";
import { isKnownServiceName, validateContractVersions, validateUrl } from "./urls";

const MATURITY_RANK: Record<CapabilityMaturity, number> = {
  stub: 0,
  lab: 1,
  pilot: 2,
  production: 3,
};

const STAGE_RANK: Record<DeploymentStage, number> = { dev: 0, lab: 1, pilot: 2, production: 3 };

const DEFAULT_DEGRADATION: ControlDegradation = {
  identity: "fail_closed",
  entitlement: "fail_closed",
  ai: "disable_feature",
  notification: "queue",
};

function error(code: string, path: string, message: string): ControlIssue {
  return { severity: "error", code, path, message };
}

function warning(code: string, path: string, message: string): ControlIssue {
  return { severity: "warning", code, path, message };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Fills unspecified degradation modes with the fail-safe defaults. `identity`
 * is always `fail_closed`: AuthN never degrades to anonymous access.
 */
export function resolveDegradation(
  manifest: ControlManifest,
): ControlDegradation {
  const declared = manifest.degradation ?? {};
  const entitlementDefault: ControlDegradation["entitlement"] =
    manifest.capabilities?.entitlement === "offline_license"
      ? "offline_license"
      : manifest.capabilities?.entitlement === "off"
        ? "fail_open_local"
        : DEFAULT_DEGRADATION.entitlement;
  const aiDefault: ControlDegradation["ai"] =
    manifest.capabilities?.ai === "local_byok" ? "fallback_local_byok" : DEFAULT_DEGRADATION.ai;
  const notificationDefault: ControlDegradation["notification"] =
    manifest.capabilities?.notification === "none" ? "drop" : DEFAULT_DEGRADATION.notification;

  return {
    identity: "fail_closed",
    entitlement: declared.entitlement ?? entitlementDefault,
    ai: declared.ai ?? aiDefault,
    notification: declared.notification ?? notificationDefault,
  };
}

function validateShape(input: unknown): { issues: ControlIssue[]; manifest?: ControlManifest } {
  const issues: ControlIssue[] = [];
  if (!isPlainObject(input)) {
    issues.push(error("manifest_not_object", "(root)", "Control Manifest must be a JSON object."));
    return { issues };
  }

  if (input.manifestVersion !== MANIFEST_VERSION) {
    issues.push(
      error(
        "manifest_version_unsupported",
        "manifestVersion",
        `manifestVersion must be ${MANIFEST_VERSION}; received ${JSON.stringify(input.manifestVersion)}.`,
      ),
    );
  }

  if (!CONTROL_PROFILES.includes(input.profile as ControlProfile)) {
    issues.push(
      error(
        "profile_unknown",
        "profile",
        `profile must be one of: ${CONTROL_PROFILES.join(" | ")}.`,
      ),
    );
  }

  if (!DEPLOYMENT_STAGES.includes(input.stage as DeploymentStage)) {
    issues.push(
      error("stage_unknown", "stage", `stage must be one of: ${DEPLOYMENT_STAGES.join(" | ")}.`),
    );
  }

  if (!isPlainObject(input.capabilities)) {
    issues.push(
      error("capabilities_missing", "capabilities", "capabilities object is required."),
    );
  } else {
    const caps = input.capabilities;
    if (!IDENTITY_MODES.includes(caps.identity as never)) {
      issues.push(
        error(
          "identity_mode_unknown",
          "capabilities.identity",
          `capabilities.identity must be one of: ${IDENTITY_MODES.join(" | ")}.`,
        ),
      );
    }
    if (!ENTITLEMENT_MODES.includes(caps.entitlement as never)) {
      issues.push(
        error(
          "entitlement_mode_unknown",
          "capabilities.entitlement",
          `capabilities.entitlement must be one of: ${ENTITLEMENT_MODES.join(" | ")}.`,
        ),
      );
    }
    if (!AI_MODES.includes(caps.ai as never)) {
      issues.push(
        error(
          "ai_mode_unknown",
          "capabilities.ai",
          `capabilities.ai must be one of: ${AI_MODES.join(" | ")}.`,
        ),
      );
    }
    if (!NOTIFICATION_MODES.includes(caps.notification as never)) {
      issues.push(
        error(
          "notification_mode_unknown",
          "capabilities.notification",
          `capabilities.notification must be one of: ${NOTIFICATION_MODES.join(" | ")}.`,
        ),
      );
    }
  }

  if (input.services !== undefined && !isPlainObject(input.services)) {
    issues.push(error("services_invalid", "services", "services must be an object."));
  }
  if (input.products !== undefined && !isPlainObject(input.products)) {
    issues.push(error("products_invalid", "products", "products must be an object."));
  }
  if (input.degradation !== undefined && !isPlainObject(input.degradation)) {
    issues.push(error("degradation_invalid", "degradation", "degradation must be an object."));
  }

  if (issues.some((issue) => issue.severity === "error")) return { issues };
  return { issues, manifest: input as unknown as ControlManifest };
}

function validateServices(manifest: ControlManifest): ControlIssue[] {
  const issues: ControlIssue[] = [];
  const services = manifest.services ?? {};

  for (const [name, ref] of Object.entries(services)) {
    const path = `services.${name}`;
    if (!isKnownServiceName(name)) {
      issues.push(
        error(
          "service_unknown",
          path,
          `Unknown central service "${name}". Known services: ${CONTROL_SERVICE_NAMES.join(", ")}. The manifest is not a dynamic service registry.`,
        ),
      );
      continue;
    }
    if (!isPlainObject(ref)) {
      issues.push(error("service_invalid", path, "Service entry must be an object."));
      continue;
    }
    issues.push(...validateUrl(ref.url, `${path}.url`, manifest.stage));
    if (typeof ref.required !== "boolean") {
      issues.push(
        error(
          "service_required_missing",
          `${path}.required`,
          "required must be an explicit boolean so degradation behaviour is never implicit.",
        ),
      );
    }
    issues.push(...validateContractVersions(name, ref.apiVersion, ref.schemaVersion, path));
  }

  return issues;
}

function validateProducts(manifest: ControlManifest): ControlIssue[] {
  const issues: ControlIssue[] = [];
  const products = manifest.products ?? {};

  for (const [code, ref] of Object.entries(products)) {
    const path = `products.${code}`;
    if (!(PRODUCT_CODES as readonly string[]).includes(code)) {
      issues.push(
        error("product_unknown", path, `Unknown product "${code}". Known: ${PRODUCT_CODES.join(", ")}.`),
      );
      continue;
    }
    if (!isPlainObject(ref)) {
      issues.push(error("product_invalid", path, "Product entry must be an object."));
      continue;
    }
    issues.push(...validateUrl(ref.url, `${path}.url`, manifest.stage));
    if (typeof ref.required !== "boolean") {
      issues.push(
        error("product_required_missing", `${path}.required`, "required must be an explicit boolean."),
      );
    }
    if (
      (NON_RUNTIME_PRODUCTS as readonly string[]).includes(code) &&
      (ref as { required?: unknown }).required === true
    ) {
      issues.push(
        error(
          "non_runtime_product_required",
          `${path}.required`,
          `"${code}" is a training/enablement plane and must not be a production runtime dependency; set required=false.`,
        ),
      );
    }
  }

  const expected = PROFILE_PRODUCTS[manifest.profile] ?? [];
  for (const code of expected) {
    if (!(code in products)) {
      issues.push(
        error(
          "profile_product_missing",
          `products.${code}`,
          `Profile "${manifest.profile}" requires product "${code}" to be declared.`,
        ),
      );
    }
  }

  if (manifest.profile === "standalone" && Object.keys(products).length > 1) {
    issues.push(
      error(
        "standalone_multi_product",
        "products",
        "Profile standalone describes a single product plane; use agent-commerce or smart-site for multi-product scenarios.",
      ),
    );
  }

  return issues;
}

function validateCapabilityWiring(manifest: ControlManifest): ControlIssue[] {
  const issues: ControlIssue[] = [];
  const services = manifest.services ?? {};
  const caps = manifest.capabilities;
  const hardened = HARDENED_STAGES.includes(manifest.stage);

  // ---- Identity: AuthN is never optional and never silently anonymous. ----
  if (caps.identity === "central" || caps.identity === "external_oidc") {
    const ref = services.identity;
    if (!ref) {
      issues.push(
        error(
          "identity_service_missing",
          "services.identity",
          `capabilities.identity=${caps.identity} requires services.identity (issuer base URL).`,
        ),
      );
    } else if (ref.required === false) {
      issues.push(
        error(
          "identity_service_optional",
          "services.identity.required",
          "AuthN must not be optional: services.identity.required must be true.",
        ),
      );
    }
  } else if (caps.identity === "local" && services.identity) {
    issues.push(
      warning(
        "identity_service_unused",
        "services.identity",
        "capabilities.identity=local ignores services.identity; remove it to avoid drift.",
      ),
    );
  }

  if (caps.identity === "local" && hardened && manifest.profile !== "air-gapped") {
    issues.push(
      error(
        "identity_local_not_hardened",
        "capabilities.identity",
        `identity=local is a lab-only mode; stage "${manifest.stage}" requires central or external_oidc (air-gapped profile excepted).`,
      ),
    );
  }

  if (services.authGateway && caps.identity === "local") {
    issues.push(
      warning(
        "auth_gateway_unused",
        "services.authGateway",
        "Auth Gateway only proxies an OIDC provider; it has no role when identity=local.",
      ),
    );
  }

  // ---- Entitlement ----
  if (caps.entitlement === "enforce" || caps.entitlement === "shadow_read") {
    const ref = services.entitlement;
    if (!ref) {
      issues.push(
        error(
          "entitlement_service_missing",
          "services.entitlement",
          `capabilities.entitlement=${caps.entitlement} requires services.entitlement.`,
        ),
      );
    } else if (caps.entitlement === "enforce" && ref.required === false) {
      issues.push(
        error(
          "entitlement_enforce_optional",
          "services.entitlement.required",
          "entitlement=enforce means central decisions are authoritative; required must be true.",
        ),
      );
    }
  }
  if (caps.entitlement === "offline_license" && services.entitlement?.required === true) {
    issues.push(
      error(
        "offline_license_requires_no_service",
        "services.entitlement.required",
        "entitlement=offline_license must not hard-depend on the central service; set required=false or drop the entry.",
      ),
    );
  }
  if (caps.entitlement === "off" && services.entitlement) {
    issues.push(
      warning(
        "entitlement_service_unused",
        "services.entitlement",
        "capabilities.entitlement=off ignores services.entitlement; remove it to avoid drift.",
      ),
    );
  }

  // ---- AI ----
  if (caps.ai === "central") {
    if (!services.ai) {
      issues.push(
        error("ai_service_missing", "services.ai", "capabilities.ai=central requires services.ai."),
      );
    }
    if (hardened) {
      issues.push(
        error(
          "ai_central_not_hardened",
          "capabilities.ai",
          `ai=central is not hardened for stage "${manifest.stage}" (missing: ${AI_CENTRAL_HARDENING_BLOCKERS.join(", ")}). Use ai=off or ai=local_byok.`,
        ),
      );
    }
  } else if (services.ai?.required === true) {
    issues.push(
      error(
        "ai_service_required_without_central",
        "services.ai.required",
        `capabilities.ai=${caps.ai} must not mark services.ai as required.`,
      ),
    );
  }

  // ---- Notification ----
  if (caps.notification === "none" && services.notification) {
    issues.push(
      warning(
        "notification_service_unused",
        "services.notification",
        "capabilities.notification=none ignores services.notification; remove it to avoid drift.",
      ),
    );
  }
  if (caps.notification === "smtp") {
    issues.push(
      warning(
        "notification_credentials_external",
        "capabilities.notification",
        "SMTP credentials must come from env or a secret store — never from this manifest.",
      ),
    );
  }

  return issues;
}

function validateDegradation(manifest: ControlManifest): ControlIssue[] {
  const issues: ControlIssue[] = [];
  const declared = manifest.degradation ?? {};
  const resolved = resolveDegradation(manifest);
  const hardened = HARDENED_STAGES.includes(manifest.stage);

  if (declared.identity !== undefined && declared.identity !== "fail_closed") {
    issues.push(
      error(
        "identity_degradation_not_fail_closed",
        "degradation.identity",
        "AuthN must not degrade: degradation.identity must be fail_closed (no anonymous fallback).",
      ),
    );
  }

  if (manifest.capabilities?.entitlement === "enforce" && resolved.entitlement === "fail_open_local") {
    issues.push(
      hardened
        ? error(
            "entitlement_fail_open_in_hardened_stage",
            "degradation.entitlement",
            `entitlement=enforce with fail_open_local grants paid features for free when the central service is down; not allowed in stage "${manifest.stage}".`,
          )
        : warning(
            "entitlement_fail_open",
            "degradation.entitlement",
            "entitlement=enforce with fail_open_local grants paid features for free when the central service is down.",
          ),
    );
  }

  if (
    manifest.capabilities?.entitlement === "offline_license" &&
    resolved.entitlement !== "offline_license"
  ) {
    issues.push(
      error(
        "offline_license_degradation_mismatch",
        "degradation.entitlement",
        "entitlement=offline_license requires degradation.entitlement=offline_license.",
      ),
    );
  }

  if (manifest.capabilities?.ai === "off" && resolved.ai === "fallback_local_byok") {
    issues.push(
      error(
        "ai_off_with_byok_fallback",
        "degradation.ai",
        "capabilities.ai=off cannot fall back to local_byok; that would enable AI the operator disabled.",
      ),
    );
  }

  if (resolved.notification === "drop" && manifest.capabilities?.notification === "smtp") {
    issues.push(
      warning(
        "notification_drop",
        "degradation.notification",
        "degradation.notification=drop silently loses user-visible messages; prefer queue.",
      ),
    );
  }

  return issues;
}

function validateProfileConstraints(manifest: ControlManifest): ControlIssue[] {
  const issues: ControlIssue[] = [];
  const caps = manifest.capabilities;
  const profile: ControlProfile = manifest.profile;

  if (profile === "air-gapped") {
    if (caps.ai === "central") {
      issues.push(
        error(
          "air_gapped_central_ai",
          "capabilities.ai",
          "air-gapped deployments cannot call a central AI Platform; use off or local_byok.",
        ),
      );
    }
    if (caps.entitlement === "enforce" || caps.entitlement === "shadow_read") {
      issues.push(
        error(
          "air_gapped_central_entitlement",
          "capabilities.entitlement",
          "air-gapped deployments cannot reach central Entitlement; use offline_license or off.",
        ),
      );
    }
    if (caps.identity === "central") {
      issues.push(
        warning(
          "air_gapped_central_identity",
          "capabilities.identity",
          "air-gapped deployments normally use the customer IdP (external_oidc) or a local directory.",
        ),
      );
    }
  }

  if (profile === "control-plane" && !manifest.services?.identity) {
    issues.push(
      error(
        "control_plane_without_identity",
        "services.identity",
        "Profile control-plane must publish an identity issuer URL.",
      ),
    );
  }

  if (profile === "standalone" && caps.entitlement === "enforce") {
    issues.push(
      warning(
        "standalone_enforce",
        "capabilities.entitlement",
        "entitlement=enforce makes this standalone plane hard-depend on the central service; consider the control-plane profile or offline_license.",
      ),
    );
  }

  return issues;
}

function validateStageMaturity(manifest: ControlManifest): ControlIssue[] {
  const issues: ControlIssue[] = [];
  const stageRank = STAGE_RANK[manifest.stage];
  const caps = manifest.capabilities;

  const checks: { key: keyof typeof CAPABILITY_MATURITY; mode: string }[] = [
    { key: "identity", mode: caps.identity },
    { key: "entitlement", mode: caps.entitlement },
    { key: "ai", mode: caps.ai },
    { key: "notification", mode: caps.notification },
  ];

  for (const { key, mode } of checks) {
    const table = CAPABILITY_MATURITY[key] as Record<string, CapabilityMaturity>;
    const maturity = table[mode];
    if (!maturity) continue;
    if (MATURITY_RANK[maturity] >= stageRank) continue;

    const airGappedLocalIdentity =
      key === "identity" && mode === "local" && manifest.profile === "air-gapped";
    const severity: ControlIssue["severity"] =
      maturity === "pilot" || airGappedLocalIdentity ? "warning" : "error";
    const message = `${key}=${mode} is "${maturity}" maturity but stage is "${manifest.stage}". Do not describe it as generally available.`;

    issues.push(
      severity === "error"
        ? error("capability_not_ready_for_stage", `capabilities.${key}`, message)
        : warning("capability_below_stage_maturity", `capabilities.${key}`, message),
    );
  }

  return issues;
}

/**
 * Full manifest validation. Returns every issue found instead of throwing on
 * the first one, so operators can fix a deployment in a single pass.
 */
export function validateControlManifest(input: unknown): ValidationResult {
  const issues: ControlIssue[] = [...scanForSecrets(input)];

  const shape = validateShape(input);
  issues.push(...shape.issues);

  if (shape.manifest) {
    const manifest = shape.manifest;
    issues.push(...validateServices(manifest));
    issues.push(...validateProducts(manifest));
    issues.push(...validateCapabilityWiring(manifest));
    issues.push(...validateDegradation(manifest));
    issues.push(...validateProfileConstraints(manifest));
    issues.push(...validateStageMaturity(manifest));
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  return { ok: errors.length === 0, errors, warnings };
}

/** Services whose outage must block traffic, per the manifest declaration. */
export function requiredServices(manifest: ControlManifest): ControlServiceName[] {
  return Object.entries(manifest.services ?? {})
    .filter(([, ref]) => ref?.required === true)
    .map(([name]) => name as ControlServiceName);
}

export function optionalServices(manifest: ControlManifest): ControlServiceName[] {
  return Object.entries(manifest.services ?? {})
    .filter(([, ref]) => ref?.required !== true)
    .map(([name]) => name as ControlServiceName);
}

export function requiredProducts(manifest: ControlManifest): ProductCode[] {
  return Object.entries(manifest.products ?? {})
    .filter(([, ref]) => ref?.required === true)
    .map(([code]) => code as ProductCode);
}

export function withResolvedDegradation(manifest: ControlManifest): ResolvedControlManifest {
  return { ...manifest, degradation: resolveDegradation(manifest) };
}
