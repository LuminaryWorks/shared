import { createPublicKey, verify, type KeyObject } from "node:crypto";
import { canonicalize } from "./canonical-json";

export interface LicensePayload {
  licenseId: string;
  kid: string;
  deploymentId: string;
  products: string[];
  features: Record<string, Record<string, boolean | number>>;
  seats?: Record<string, number>;
  issuedAt: string;
  expiresAt: string;
  offlineGraceDays: number;
  customerName?: string;
}

export interface SignedLicense {
  payload: LicensePayload;
  signature: string;
}

export type PublicKeyRing = Record<string, string>;

export type LicenseVerifyFailure =
  | "ENTITLEMENT_LICENSE_INVALID"
  | "ENTITLEMENT_LICENSE_EXPIRED";

export interface LicenseVerifyOk {
  ok: true;
  payload: LicensePayload;
  withinGrace: boolean;
}

export interface LicenseVerifyErr {
  ok: false;
  code: LicenseVerifyFailure;
  message: string;
}

function loadPublicKey(pemOrBase64: string): KeyObject {
  if (pemOrBase64.includes("BEGIN")) {
    return createPublicKey({ key: pemOrBase64, format: "pem" });
  }
  const normalized = pemOrBase64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const der = Buffer.concat([
    Buffer.from("302a300506032b6570032100", "hex"),
    Buffer.from(normalized + pad, "base64"),
  ]);
  return createPublicKey({ key: der, format: "der", type: "spki" });
}

/**
 * Local Ed25519 license verification for private deployments.
 * Does NOT bypass Casbin — only answers commercial feature/quota questions.
 */
export function verifySignedLicense(
  license: SignedLicense,
  ring: PublicKeyRing,
  opts?: {
    now?: Date;
    requireProduct?: string;
    requireFeature?: string;
    /** When true, grace only applies if a prior successful verify was cached by caller. */
    allowGrace?: boolean;
  },
): LicenseVerifyOk | LicenseVerifyErr {
  const { payload, signature } = license;
  if (!payload?.kid || !payload.licenseId || !payload.deploymentId) {
    return { ok: false, code: "ENTITLEMENT_LICENSE_INVALID", message: "Malformed license payload" };
  }
  const pub = ring[payload.kid];
  if (!pub) {
    return { ok: false, code: "ENTITLEMENT_LICENSE_INVALID", message: `Unknown kid ${payload.kid}` };
  }

  let validSig = false;
  try {
    const key = loadPublicKey(pub);
    const bytes = Buffer.from(canonicalize(payload), "utf8");
    const sig = Buffer.from(signature, "base64url");
    validSig = verify(null, bytes, key, sig);
  } catch {
    return { ok: false, code: "ENTITLEMENT_LICENSE_INVALID", message: "Signature verification failed" };
  }
  if (!validSig) {
    return { ok: false, code: "ENTITLEMENT_LICENSE_INVALID", message: "Tampered or invalid signature" };
  }

  const now = opts?.now ?? new Date();
  const expiresAt = new Date(payload.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    return { ok: false, code: "ENTITLEMENT_LICENSE_INVALID", message: "Invalid expiresAt" };
  }
  // Spec §6.2: first install / no prior successful cache must not grant grace.
  // Callers opt in explicitly after a prior verified cache (`allowGrace: true`).
  const allowGrace = opts?.allowGrace === true;
  const graceMs = allowGrace
    ? Math.max(0, payload.offlineGraceDays ?? 0) * 24 * 60 * 60 * 1000
    : 0;
  const hardExpiry = new Date(expiresAt.getTime() + graceMs);
  if (now >= hardExpiry) {
    return {
      ok: false,
      code: "ENTITLEMENT_LICENSE_EXPIRED",
      message: "License expired (including offline grace)",
    };
  }
  const withinGrace = now >= expiresAt && now < hardExpiry;

  if (opts?.requireProduct && !payload.products.includes(opts.requireProduct)) {
    return {
      ok: false,
      code: "ENTITLEMENT_LICENSE_INVALID",
      message: `Product ${opts.requireProduct} not in license`,
    };
  }
  if (opts?.requireProduct && opts.requireFeature) {
    const feats = payload.features?.[opts.requireProduct] ?? {};
    const v = feats[opts.requireFeature];
    if (v !== true && !(typeof v === "number" && v > 0)) {
      return {
        ok: false,
        code: "ENTITLEMENT_LICENSE_INVALID",
        message: `Feature ${opts.requireFeature} not granted`,
      };
    }
  }

  return { ok: true, payload, withinGrace };
}

export function featureAllowed(
  payload: LicensePayload,
  productCode: string,
  featureCode: string,
): boolean {
  const v = payload.features?.[productCode]?.[featureCode];
  return v === true || (typeof v === "number" && v > 0);
}

export function featureLimit(
  payload: LicensePayload,
  productCode: string,
  featureCode: string,
): number | null {
  const v = payload.features?.[productCode]?.[featureCode];
  return typeof v === "number" ? v : null;
}

export function parsePublicKeyRing(raw: string | undefined): PublicKeyRing {
  if (!raw?.trim()) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("License public key ring must be a JSON object of kid→publicKey");
  }
  const ring: PublicKeyRing = {};
  for (const [kid, val] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof val !== "string" || !val.trim()) {
      throw new Error(`Invalid public key for kid ${kid}`);
    }
    if (val.includes("PRIVATE")) {
      throw new Error("Private keys must not be placed in the public key ring");
    }
    ring[kid] = val;
  }
  return ring;
}
