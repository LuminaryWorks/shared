import { CONTROL_SERVICE_NAMES } from "./constants";
import { isSecretLikeKey } from "./secrets";
import type { ControlIssue, ControlManifest, ControlServiceName } from "./types";

/**
 * Environment overlay.
 *
 * The committed manifest stays the source of truth for *topology*: which
 * central services exist and which contract versions they speak. The env
 * overlay only retargets declared entries (URL / required) and switches
 * capability modes, so a deployment can move between hosts without editing the
 * manifest — and cannot grow untracked services behind the operator's back.
 */

interface CapabilityBinding {
  key: "identity" | "entitlement" | "ai" | "notification";
  envKeys: readonly string[];
}

const CAPABILITY_BINDINGS: readonly CapabilityBinding[] = [
  { key: "identity", envKeys: ["LW_IDENTITY_MODE"] },
  { key: "entitlement", envKeys: ["LW_ENTITLEMENT_MODE", "ENTITLEMENT_MODE"] },
  { key: "ai", envKeys: ["LW_AI_MODE"] },
  { key: "notification", envKeys: ["LW_NOTIFICATION_MODE"] },
];

const SERVICE_URL_BINDINGS: Readonly<Record<ControlServiceName, readonly string[]>> = {
  identity: ["LW_IDENTITY_URL", "IDP_ISSUER"],
  authGateway: ["LW_AUTH_GATEWAY_URL", "AUTH_GATEWAY_PUBLIC_URL"],
  entitlement: ["LW_ENTITLEMENT_URL", "ENTITLEMENT_BASE_URL"],
  ai: ["LW_AI_URL", "AI_PLATFORM_BASE_URL"],
  notification: ["LW_NOTIFICATION_URL"],
  observability: ["LW_OBSERVABILITY_URL", "OTEL_EXPORTER_OTLP_ENDPOINT"],
};

const SERVICE_REQUIRED_BINDINGS: Readonly<Record<ControlServiceName, readonly string[]>> = {
  identity: ["LW_IDENTITY_REQUIRED"],
  authGateway: ["LW_AUTH_GATEWAY_REQUIRED"],
  entitlement: ["LW_ENTITLEMENT_REQUIRED"],
  ai: ["LW_AI_REQUIRED"],
  notification: ["LW_NOTIFICATION_REQUIRED"],
  observability: ["LW_OBSERVABILITY_REQUIRED"],
};

const DEGRADATION_BINDINGS: readonly {
  key: "identity" | "entitlement" | "ai" | "notification";
  envKey: string;
}[] = [
  { key: "identity", envKey: "LW_IDENTITY_DEGRADATION" },
  { key: "entitlement", envKey: "LW_ENTITLEMENT_DEGRADATION" },
  { key: "ai", envKey: "LW_AI_DEGRADATION" },
  { key: "notification", envKey: "LW_NOTIFICATION_DEGRADATION" },
];

export const OVERLAY_ENV_KEYS: readonly string[] = [
  "LW_PROFILE",
  "LW_STAGE",
  ...CAPABILITY_BINDINGS.flatMap((binding) => binding.envKeys),
  ...Object.values(SERVICE_URL_BINDINGS).flat(),
  ...Object.values(SERVICE_REQUIRED_BINDINGS).flat(),
  ...DEGRADATION_BINDINGS.map((binding) => binding.envKey),
];

function firstSet(
  env: Record<string, string | undefined>,
  keys: readonly string[],
): { key: string; value: string } | null {
  for (const key of keys) {
    const raw = env[key];
    if (raw !== undefined && raw.trim() !== "") return { key, value: raw.trim() };
  }
  return null;
}

function parseBoolean(value: string): boolean | null {
  const normalized = value.toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

export interface OverlayResult {
  manifest: ControlManifest;
  issues: ControlIssue[];
  appliedEnvKeys: string[];
}

export function applyEnvOverlay(
  manifest: ControlManifest,
  env: Record<string, string | undefined>,
): OverlayResult {
  const issues: ControlIssue[] = [];
  const applied: string[] = [];
  // Service entries are cloned too: the overlay must never mutate its input.
  const clonedServices = Object.fromEntries(
    Object.entries(manifest.services ?? {}).map(([name, ref]) => [
      name,
      ref && typeof ref === "object" ? { ...ref } : ref,
    ]),
  ) as ControlManifest["services"];

  const next: ControlManifest = {
    ...manifest,
    capabilities: { ...manifest.capabilities },
    services: clonedServices,
    degradation: { ...(manifest.degradation ?? {}) },
    ...(manifest.products ? { products: { ...manifest.products } } : {}),
  };

  for (const key of Object.keys(env)) {
    if (key.startsWith("LW_") && isSecretLikeKey(key)) {
      issues.push({
        severity: "warning",
        code: "secret_like_env_ignored",
        path: key,
        message: `Env "${key}" looks secret-like and is not part of the Control Manifest overlay; it is ignored here and must be consumed by the owning service.`,
      });
    }
  }

  const profile = firstSet(env, ["LW_PROFILE"]);
  if (profile) {
    next.profile = profile.value as ControlManifest["profile"];
    applied.push(profile.key);
  }

  const stage = firstSet(env, ["LW_STAGE"]);
  if (stage) {
    next.stage = stage.value as ControlManifest["stage"];
    applied.push(stage.key);
  }

  for (const binding of CAPABILITY_BINDINGS) {
    const hit = firstSet(env, binding.envKeys);
    if (!hit) continue;
    (next.capabilities as unknown as Record<string, string>)[binding.key] = hit.value;
    applied.push(hit.key);
  }

  for (const name of CONTROL_SERVICE_NAMES) {
    const urlHit = firstSet(env, SERVICE_URL_BINDINGS[name]);
    const requiredHit = firstSet(env, SERVICE_REQUIRED_BINDINGS[name]);
    const declared = next.services?.[name];

    if (!declared) {
      for (const hit of [urlHit, requiredHit]) {
        if (!hit) continue;
        issues.push({
          severity: "warning",
          code: "env_service_not_declared",
          path: hit.key,
          message: `Env "${hit.key}" was ignored because services.${name} is not declared in the manifest. Declare the service (with apiVersion/schemaVersion) to make the topology auditable.`,
        });
      }
      continue;
    }

    if (urlHit) {
      declared.url = urlHit.value.replace(/\/$/, "");
      applied.push(urlHit.key);
    }
    if (requiredHit) {
      const parsed = parseBoolean(requiredHit.value);
      if (parsed === null) {
        issues.push({
          severity: "error",
          code: "env_boolean_invalid",
          path: requiredHit.key,
          message: `Env "${requiredHit.key}"="${requiredHit.value}" is not a boolean (true/false).`,
        });
      } else {
        declared.required = parsed;
        applied.push(requiredHit.key);
      }
    }
  }

  for (const binding of DEGRADATION_BINDINGS) {
    const hit = firstSet(env, [binding.envKey]);
    if (!hit) continue;
    if (binding.key === "identity" && hit.value !== "fail_closed") {
      issues.push({
        severity: "error",
        code: "identity_degradation_not_fail_closed",
        path: hit.key,
        message: `Env "${hit.key}"="${hit.value}" is rejected: AuthN must not degrade to anonymous access.`,
      });
      continue;
    }
    (next.degradation as unknown as Record<string, string>)[binding.key] = hit.value;
    applied.push(hit.key);
  }

  return { manifest: next, issues, appliedEnvKeys: applied };
}
