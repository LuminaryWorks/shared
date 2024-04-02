import { createHmac, timingSafeEqual } from "crypto";
import type { LuminaryJwtPayload } from "./types";

interface LegacyPayload {
  sub: string;
  name?: string;
  roles?: string[];
  exp?: number;
}

function base64UrlDecode(input: string): Buffer {
  const padded = input + "=".repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/** Minimal HS256 verify for dev/legacy tokens (no external deps). */
export function verifyLegacyJwt(token: string, secret: string): LuminaryJwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  const data = `${headerB64}.${payloadB64}`;
  const expected = createHmac("sha256", secret).update(data).digest();
  const actual = base64UrlDecode(signatureB64);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  let payload: LegacyPayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf8")) as LegacyPayload;
  } catch {
    return null;
  }

  if (payload.exp && payload.exp * 1000 < Date.now()) return null;
  if (!payload.sub) return null;

  return {
    sub: payload.sub,
    name: payload.name,
    roles: payload.roles,
  };
}
