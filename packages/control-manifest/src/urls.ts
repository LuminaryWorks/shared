import {
  CONTROL_SERVICE_NAMES,
  HARDENED_STAGES,
  SUPPORTED_CONTRACTS,
} from "./constants";
import type { ControlIssue, ControlServiceName, DeploymentStage } from "./types";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

/** Docker-desktop-only escape hatch; never valid for a portable deployment. */
const FORBIDDEN_HOSTS = new Set(["host.docker.internal", "gateway.docker.internal"]);

const INTERNAL_SUFFIXES = [".internal", ".svc", ".svc.cluster.local", ".local", ".cluster.local"];

function isInternalDnsName(hostname: string): boolean {
  if (!hostname.includes(".")) return true; // Compose/K8s service name
  return INTERNAL_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

export function validateUrl(
  raw: unknown,
  path: string,
  stage: DeploymentStage,
): ControlIssue[] {
  const issues: ControlIssue[] = [];
  if (typeof raw !== "string" || raw.trim() === "") {
    issues.push({
      severity: "error",
      code: "url_missing",
      path,
      message: "URL is required and must be a non-empty string.",
    });
    return issues;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    issues.push({
      severity: "error",
      code: "url_invalid",
      path,
      message: `"${raw}" is not an absolute URL.`,
    });
    return issues;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    issues.push({
      severity: "error",
      code: "url_scheme_unsupported",
      path,
      message: `Scheme "${url.protocol.replace(":", "")}" is not supported; use http or https.`,
    });
  }

  if (url.username || url.password) {
    issues.push({
      severity: "error",
      code: "inline_url_credentials",
      path,
      message: "URL must not embed credentials; supply them via env or a secret store.",
    });
  }

  const hostname = url.hostname.toLowerCase();

  if (FORBIDDEN_HOSTS.has(hostname)) {
    issues.push({
      severity: "error",
      code: "host_docker_internal",
      path,
      message: `"${hostname}" is not portable. Use a Compose/K8s service name on a shared network.`,
    });
  }

  const hardened = HARDENED_STAGES.includes(stage);
  if (hardened && LOOPBACK_HOSTS.has(hostname)) {
    issues.push({
      severity: "error",
      code: "loopback_in_hardened_stage",
      path,
      message: `Loopback host "${hostname}" cannot be reached from another container or node in stage "${stage}".`,
    });
  }

  if (hardened && url.protocol === "http:" && !isInternalDnsName(hostname)) {
    issues.push({
      severity: "error",
      code: "plaintext_external_url",
      path,
      message: `Stage "${stage}" requires https for externally routable host "${hostname}".`,
    });
  }

  if (url.search || url.hash) {
    issues.push({
      severity: "warning",
      code: "url_has_query",
      path,
      message: "Service base URL should not carry a query string or fragment.",
    });
  }

  return issues;
}

export function validateContractVersions(
  name: ControlServiceName,
  apiVersion: unknown,
  schemaVersion: unknown,
  basePath: string,
): ControlIssue[] {
  const issues: ControlIssue[] = [];
  const supported = SUPPORTED_CONTRACTS[name];
  if (!supported) return issues;

  if (typeof apiVersion !== "string" || apiVersion.trim() === "") {
    issues.push({
      severity: "error",
      code: "api_version_missing",
      path: `${basePath}.apiVersion`,
      message: `apiVersion is required; supported: ${supported.apiVersions.join(", ")}.`,
    });
  } else if (!supported.apiVersions.includes(apiVersion)) {
    issues.push({
      severity: "error",
      code: "api_version_unsupported",
      path: `${basePath}.apiVersion`,
      message: `apiVersion "${apiVersion}" is not supported; supported: ${supported.apiVersions.join(", ")}.`,
    });
  }

  if (typeof schemaVersion !== "string" || schemaVersion.trim() === "") {
    issues.push({
      severity: "error",
      code: "schema_version_missing",
      path: `${basePath}.schemaVersion`,
      message: `schemaVersion is required; supported: ${supported.schemaVersions.join(", ")}.`,
    });
  } else if (!supported.schemaVersions.includes(schemaVersion)) {
    issues.push({
      severity: "error",
      code: "schema_version_unsupported",
      path: `${basePath}.schemaVersion`,
      message: `schemaVersion "${schemaVersion}" is not supported; supported: ${supported.schemaVersions.join(", ")}.`,
    });
  }

  return issues;
}

export function isKnownServiceName(name: string): name is ControlServiceName {
  return (CONTROL_SERVICE_NAMES as readonly string[]).includes(name);
}
