/**
 * Self-register email policy.
 *
 * Default is open: any address that matches the email shape and length limits
 * may register. Set mode `allowlist` only when a deploy wants a closed set.
 */

/** Seconds before the same address can request another register verification code. */
export const DEFAULT_REGISTER_CODE_COOLDOWN_SEC = 120;

import { isRegisterEmailShape } from "./register-field-limits";

/** Popular consumer inboxes (CN + global). Lowercase host only. */
export const DEFAULT_REGISTER_EMAIL_ALLOWLIST: readonly string[] = [
  // Google
  "gmail.com",
  "googlemail.com",
  // Tencent / QQ
  "qq.com",
  "foxmail.com",
  // NetEase
  "163.com",
  "126.com",
  "yeah.net",
  // Microsoft
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  // Apple
  "icloud.com",
  "me.com",
  "mac.com",
  // Yahoo
  "yahoo.com",
  "yahoo.co.jp",
  // Proton
  "proton.me",
  "protonmail.com",
  // Others commonly used by real users
  "sina.com",
  "sina.cn",
  "aliyun.com",
  "139.com",
];

export type RegisterEmailMode = "allowlist" | "blocklist" | "off";

export interface RegisterEmailPolicy {
  mode: RegisterEmailMode;
  allowlist: readonly string[];
  blocklist: readonly string[];
  /** Seconds before the same email can request another register code. */
  codeCooldownSec: number;
}

export interface RegisterEmailPolicyInput {
  mode?: string | null;
  allowlist?: string | readonly string[] | null;
  blocklist?: string | readonly string[] | null;
  codeCooldownSec?: number | null;
}

function parseList(raw: string | readonly string[] | null | undefined): string[] {
  if (!raw) return [];
  const parts = Array.isArray(raw) ? raw : String(raw).split(/[\s,;]+/);
  return [
    ...new Set(
      parts
        .map((s) => s.trim().toLowerCase().replace(/^@/, ""))
        .filter(Boolean),
    ),
  ];
}

export function normalizeRegisterEmailMode(raw: string | null | undefined): RegisterEmailMode {
  const key = (raw ?? "").trim().toLowerCase();
  if (key === "allowlist" || key === "allow") return "allowlist";
  if (key === "blocklist" || key === "deny" || key === "blacklist") return "blocklist";
  if (!key || key === "off" || key === "false" || key === "0" || key === "disabled") return "off";
  return "allowlist";
}

function resolveCodeCooldownSec(raw: number | null | undefined): number {
  if (raw == null) return DEFAULT_REGISTER_CODE_COOLDOWN_SEC;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_REGISTER_CODE_COOLDOWN_SEC;
  return Math.floor(n);
}

export function resolveRegisterEmailPolicy(input: RegisterEmailPolicyInput = {}): RegisterEmailPolicy {
  const mode = normalizeRegisterEmailMode(input.mode);
  const allowlist = parseList(input.allowlist);
  const blocklist = parseList(input.blocklist);
  return {
    mode,
    allowlist: allowlist.length ? allowlist : DEFAULT_REGISTER_EMAIL_ALLOWLIST,
    blocklist,
    codeCooldownSec: resolveCodeCooldownSec(input.codeCooldownSec),
  };
}

/** Read VITE_/PUBLIC_/AUTH_REGISTER_* from a static env map (bundler-safe). */
export function readRegisterEmailPolicyFromEnv(
  env: Record<string, string | undefined> = {},
): RegisterEmailPolicy {
  return resolveRegisterEmailPolicy({
    mode:
      env.VITE_AUTH_REGISTER_EMAIL_MODE ||
      env.PUBLIC_AUTH_REGISTER_EMAIL_MODE ||
      env.NEXT_PUBLIC_AUTH_REGISTER_EMAIL_MODE ||
      env.AUTH_REGISTER_EMAIL_MODE,
    allowlist:
      env.VITE_AUTH_REGISTER_EMAIL_ALLOWLIST ||
      env.PUBLIC_AUTH_REGISTER_EMAIL_ALLOWLIST ||
      env.NEXT_PUBLIC_AUTH_REGISTER_EMAIL_ALLOWLIST ||
      env.AUTH_REGISTER_EMAIL_ALLOWLIST,
    blocklist:
      env.VITE_AUTH_REGISTER_EMAIL_BLOCKLIST ||
      env.PUBLIC_AUTH_REGISTER_EMAIL_BLOCKLIST ||
      env.NEXT_PUBLIC_AUTH_REGISTER_EMAIL_BLOCKLIST ||
      env.AUTH_REGISTER_EMAIL_BLOCKLIST,
  });
}

export function emailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  if (trimmed.includes(" ") || trimmed.indexOf("@") !== at) return null;
  return trimmed.slice(at + 1);
}

export function isValidEmailShape(email: string): boolean {
  return isRegisterEmailShape(email);
}

export type RegisterEmailDecision =
  | { ok: true; domain: string }
  | { ok: false; reason: "invalid" | "not_allowed"; domain?: string };

/** Accept any email-shaped address unless mode is `allowlist`. */
export function evaluateRegisterEmail(
  email: string,
  policy: RegisterEmailPolicy = resolveRegisterEmailPolicy(),
): RegisterEmailDecision {
  if (!isValidEmailShape(email)) return { ok: false, reason: "invalid" };
  const domain = emailDomain(email);
  if (!domain) return { ok: false, reason: "invalid" };

  if (policy.mode === "off" || policy.mode === "blocklist") return { ok: true, domain };

  if (!policy.allowlist.includes(domain)) {
    return { ok: false, reason: "not_allowed", domain };
  }
  return { ok: true, domain };
}

export function registerEmailRejectionMessage(decision: RegisterEmailDecision): string {
  if (decision.ok) return "";
  if (decision.reason === "invalid") return "Enter a valid email address (6–64 characters)";
  return "This email provider is not accepted for self-registration. Use Gmail, Outlook, QQ, 163, iCloud, or another allowed provider — or sign in with Google / GitHub.";
}

/**
 * Human-readable domain list for the register form (allowlist mode only).
 * Returns null when domains are not restricted to an allowlist.
 */
export function formatAllowedEmailDomains(
  policy: RegisterEmailPolicy,
  options?: { max?: number },
): string | null {
  if (policy.mode !== "allowlist") return null;
  const list = [...policy.allowlist].map((d) => d.toLowerCase()).filter(Boolean);
  if (!list.length) return null;
  if (options?.max == null) return list.join(", ");
  const max = options.max;
  const shown = list.slice(0, max);
  const rest = list.length - shown.length;
  const body = shown.join(", ");
  return rest > 0 ? `${body}, +${rest} more` : body;
}

/** Full allowlist for tooltips / info popovers (allowlist mode only). */
export function listAllowedEmailDomains(policy: RegisterEmailPolicy): string[] {
  if (policy.mode !== "allowlist") return [];
  return [...policy.allowlist].map((d) => d.toLowerCase()).filter(Boolean);
}

/** Short policy note under the email field on the register form. */
export function registerEmailDomainsHint(
  policy: RegisterEmailPolicy,
  labels?: {
    allowedDomainsPrefix?: string;
    allowedDomainsOpen?: string;
    allowedDomainsBlocklist?: string;
  },
): string | null {
  const prefix = labels?.allowedDomainsPrefix ?? "Allowed email domains";
  const formatted = formatAllowedEmailDomains(policy);
  if (!formatted) return null;
  return `${prefix}: ${formatted}`;
}

/** Public policy document from Auth Gateway `GET /api/register-policy`. */
export interface PublicRegisterPolicyResponse {
  mode?: string;
  allowlist?: string[];
  blocklist?: string[];
  ipDailyLimit?: number;
  codeHourlyLimit?: number;
  codeCooldownSec?: number;
  enabled?: boolean;
}

/**
 * Fetch live register policy from Auth Gateway (or any host that serves `/api/register-policy`).
 * Falls back to built-in defaults when the endpoint is missing.
 */
export async function fetchRegisterEmailPolicy(
  apiBase: string,
  init?: RequestInit,
): Promise<RegisterEmailPolicy> {
  const base = apiBase.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/register-policy`, {
      credentials: "omit",
      headers: { Accept: "application/json" },
      ...init,
    });
    if (!res.ok) return resolveRegisterEmailPolicy();
    const data = (await res.json()) as PublicRegisterPolicyResponse;
    return resolveRegisterEmailPolicy({
      mode: data.mode,
      allowlist: data.allowlist,
      blocklist: data.blocklist,
      codeCooldownSec: data.codeCooldownSec,
    });
  } catch {
    return resolveRegisterEmailPolicy();
  }
}
