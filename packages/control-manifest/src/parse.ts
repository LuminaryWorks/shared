import { applyEnvOverlay } from "./env";
import type {
  ControlIssue,
  ControlManifest,
  LoadOptions,
  LoadResult,
  ValidationResult,
} from "./types";
import { validateControlManifest, withResolvedDegradation } from "./validate";

export class ControlManifestError extends Error {
  readonly issues: ControlIssue[];

  constructor(message: string, issues: ControlIssue[]) {
    super(message);
    this.name = "ControlManifestError";
    this.issues = issues;
  }
}

export function formatIssues(issues: readonly ControlIssue[]): string {
  return issues.map((issue) => `[${issue.severity}] ${issue.path}: ${issue.message}`).join("\n");
}

function parseJson(raw: string): { value?: unknown; issue?: ControlIssue } {
  // Strip a UTF-8 BOM defensively: manifests must be written without one, but a
  // Windows-authored file should fail validation, not JSON.parse.
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  try {
    return { value: JSON.parse(text) };
  } catch (err) {
    return {
      issue: {
        severity: "error",
        code: "manifest_not_json",
        path: "(root)",
        message: `Manifest is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }
}

/**
 * Validates without throwing. Useful for CI reports that want every issue.
 */
export function inspectControlManifest(input: string | unknown, options: LoadOptions = {}): {
  result: ValidationResult;
  manifest?: ControlManifest;
  appliedEnvKeys: string[];
} {
  const parsed = typeof input === "string" ? parseJson(input) : { value: input };
  if (parsed.issue) {
    return {
      result: { ok: false, errors: [parsed.issue], warnings: [] },
      appliedEnvKeys: [],
    };
  }

  const overlayEnabled = options.applyEnv !== false;
  const env = options.env ?? (typeof process !== "undefined" ? process.env : {});

  let candidate = parsed.value;
  const overlayIssues: ControlIssue[] = [];
  let appliedEnvKeys: string[] = [];

  const looksLikeManifest =
    typeof candidate === "object" && candidate !== null && !Array.isArray(candidate);
  if (overlayEnabled && looksLikeManifest) {
    const base = candidate as ControlManifest;
    const overlay = applyEnvOverlay(
      { ...base, capabilities: { ...(base.capabilities ?? {}) } } as ControlManifest,
      env as Record<string, string | undefined>,
    );
    candidate = overlay.manifest;
    overlayIssues.push(...overlay.issues);
    appliedEnvKeys = overlay.appliedEnvKeys;
  }

  const result = validateControlManifest(candidate);
  const errors = [...result.errors, ...overlayIssues.filter((i) => i.severity === "error")];
  const warnings = [...result.warnings, ...overlayIssues.filter((i) => i.severity === "warning")];

  return {
    result: { ok: errors.length === 0, errors, warnings },
    manifest: errors.length === 0 ? (candidate as ControlManifest) : undefined,
    appliedEnvKeys,
  };
}

/**
 * Parses, applies the env overlay, validates and resolves degradation.
 * Throws `ControlManifestError` when the deployment is not describable —
 * startup must fail loudly rather than guess a topology.
 */
export function loadControlManifest(
  input: string | unknown,
  options: LoadOptions = {},
): LoadResult {
  const { result, manifest, appliedEnvKeys } = inspectControlManifest(input, options);
  if (!manifest || !result.ok) {
    throw new ControlManifestError(
      `Invalid Control Manifest:\n${formatIssues(result.errors)}`,
      result.errors,
    );
  }
  return {
    manifest: withResolvedDegradation(manifest),
    warnings: result.warnings,
    appliedEnvKeys,
  };
}
