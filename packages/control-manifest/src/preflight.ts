import {
  AI_CENTRAL_HARDENING_BLOCKERS,
  AI_CENTRAL_HARDENING_GATES,
  CAPABILITY_MATURITY,
} from "./constants";
import { inspectControlManifest } from "./parse";
import type {
  CapabilityMaturity,
  ControlManifest,
  LoadOptions,
  PreflightResult,
} from "./types";
import { optionalServices, requiredServices } from "./validate";

/** Human-readable summary of why `ai=central` is still gated. */
export function describeAiCentralGate(): {
  hardened: boolean;
  gates: Record<string, boolean>;
  blockers: readonly string[];
} {
  return {
    hardened: AI_CENTRAL_HARDENING_BLOCKERS.length === 0,
    gates: { ...AI_CENTRAL_HARDENING_GATES },
    blockers: AI_CENTRAL_HARDENING_BLOCKERS,
  };
}

export function capabilityMaturity(
  capability: keyof typeof CAPABILITY_MATURITY,
  mode: string,
): CapabilityMaturity | undefined {
  const table = CAPABILITY_MATURITY[capability] as Record<string, CapabilityMaturity>;
  return table[mode];
}

/**
 * Startup gate: run this before a plane accepts traffic. It never performs
 * network calls — it only decides whether the declared deployment is allowed.
 * Liveness of the declared services is checked separately via `/ready`.
 */
export function preflightControlManifest(
  input: string | unknown,
  options: LoadOptions = {},
): PreflightResult {
  const { result, manifest } = inspectControlManifest(input, options);
  const effective = (manifest ?? (typeof input === "object" && input !== null ? input : {})) as
    | ControlManifest
    | Record<string, never>;

  return {
    ok: result.ok,
    profile: (effective as ControlManifest).profile,
    stage: (effective as ControlManifest).stage,
    errors: result.errors,
    warnings: result.warnings,
    requiredServices: manifest ? requiredServices(manifest) : [],
    optionalServices: manifest ? optionalServices(manifest) : [],
  };
}
