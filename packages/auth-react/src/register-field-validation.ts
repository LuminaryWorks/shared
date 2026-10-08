/**
 * Client-side register field checks (format / domain) shared by HeadlessLoginPanel.
 * Duplicate checks use Experience/API separately.
 */

import { isLogtoRegisterUsername } from "./logto-experience-adapter";
import {
  evaluateRegisterEmail,
  type RegisterEmailDecision,
  type RegisterEmailPolicy,
} from "./register-policy";

export type RegisterUsernameDecision =
  | { ok: true }
  | { ok: false; reason: "empty" | "invalid" };

export function evaluateRegisterUsername(username: string): RegisterUsernameDecision {
  const value = username.trim();
  if (!value) return { ok: false, reason: "empty" };
  if (!isLogtoRegisterUsername(value)) return { ok: false, reason: "invalid" };
  return { ok: true };
}

export function evaluateRegisterEmailField(
  email: string,
  policy: RegisterEmailPolicy,
): RegisterEmailDecision | { ok: false; reason: "empty" } {
  const value = email.trim();
  if (!value) return { ok: false, reason: "empty" };
  return evaluateRegisterEmail(value, policy);
}

/** Map Logto / Experience error codes to field-level duplicate reasons. */
export function registerDuplicateFieldFromError(error: unknown): "email" | "username" | null {
  const code =
    error && typeof error === "object" && "code" in error && typeof (error as { code: unknown }).code === "string"
      ? (error as { code: string }).code
      : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  const hay = `${code} ${message}`.toLowerCase();
  if (/username_already_in_use|username.*already|username.*in use|username.*exist/.test(hay)) {
    return "username";
  }
  if (/email_already_in_use|email.*already|email.*in use|email.*exist/.test(hay)) {
    return "email";
  }
  return null;
}
