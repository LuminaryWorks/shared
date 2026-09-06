import type { ControlIssue } from "./types";

/**
 * Keys that must never appear in a manifest. The manifest is committed to Git
 * and shipped to every plane; credentials belong in env files or a secret store.
 */
const SECRET_LIKE_KEY =
  /(secret|password|passwd|pwd|token|api[-_]?key|apikey|credential|private[-_]?key|privatekey|passphrase|mnemonic|salt|hmac|signing[-_]?key|access[-_]?key|auth[-_]?key|bearer|cookie)/i;

/** Values that look like a credential even under an innocent key name. */
const CREDENTIAL_VALUE_PATTERNS: readonly { code: string; pattern: RegExp; hint: string }[] = [
  {
    code: "inline_url_credentials",
    pattern: /^[a-z][a-z0-9+.-]*:\/\/[^/@\s]*:[^/@\s]+@/i,
    hint: "URL carries userinfo credentials",
  },
  {
    code: "inline_private_key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    hint: "PEM private key",
  },
  { code: "inline_jwt", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, hint: "JWT" },
  {
    code: "inline_provider_key",
    pattern: /\b(sk|rk|pk)-[A-Za-z0-9]{16,}\b/,
    hint: "provider API key",
  },
  {
    code: "inline_basic_auth_header",
    pattern: /\b(Basic|Bearer)\s+[A-Za-z0-9+/=_-]{16,}/,
    hint: "Authorization header value",
  },
];

export function isSecretLikeKey(key: string): boolean {
  return SECRET_LIKE_KEY.test(key);
}

export function findCredentialInValue(value: string): { code: string; hint: string } | null {
  for (const { code, pattern, hint } of CREDENTIAL_VALUE_PATTERNS) {
    if (pattern.test(value)) return { code, hint };
  }
  return null;
}

/**
 * Walks arbitrary parsed JSON and reports secret-like keys and inline
 * credentials. Runs before shape validation so a leaked secret is reported even
 * in an otherwise malformed manifest.
 */
export function scanForSecrets(value: unknown, path = ""): ControlIssue[] {
  const issues: ControlIssue[] = [];

  const walk = (node: unknown, nodePath: string): void => {
    if (typeof node === "string") {
      const found = findCredentialInValue(node);
      if (found) {
        issues.push({
          severity: "error",
          code: found.code,
          path: nodePath || "(root)",
          message: `Value looks like a credential (${found.hint}). Control Manifest must not contain secrets; reference an env var or secret store instead.`,
        });
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${nodePath}[${index}]`));
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
        const childPath = nodePath ? `${nodePath}.${key}` : key;
        if (isSecretLikeKey(key)) {
          issues.push({
            severity: "error",
            code: "secret_like_key",
            path: childPath,
            message: `Key "${key}" is secret-like and is not allowed in a Control Manifest. Move it to an env file or secret store.`,
          });
          continue;
        }
        walk(child, childPath);
      }
    }
  };

  walk(value, path);
  return issues;
}
