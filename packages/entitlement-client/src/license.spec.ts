import { createPrivateKey, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "@rstest/core";
import { EntitlementClient } from "./client";
import { canonicalize } from "./license/canonical-json";
import {
  featureAllowed,
  featureLimit,
  type LicensePayload,
  type SignedLicense,
  verifySignedLicense,
} from "./license/verify";

function signLocal(payload: LicensePayload, privateKeyPem: string): SignedLicense {
  const key = createPrivateKey({ key: privateKeyPem, format: "pem" });
  const bytes = Buffer.from(canonicalize(payload), "utf8");
  const sig = sign(null, bytes, key);
  return { payload, signature: Buffer.from(sig).toString("base64url") };
}

describe("license local verify (client)", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const kid = "test-kid";
  const payload: LicensePayload = {
    licenseId: "lic_client_1",
    kid,
    deploymentId: "dep_c1",
    products: ["vistaremote"],
    features: {
      vistaremote: { "webrtc.sfu": true, "device.limit": 10 },
    },
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2027-01-01T00:00:00.000Z",
    offlineGraceDays: 7,
  };
  const signed = signLocal(payload, privateKeyPem);

  it("verifySignedLicense accepts valid license", () => {
    const res = verifySignedLicense(signed, { [kid]: publicKeyPem });
    expect(res.ok).toBe(true);
  });

  it("rejects tamper", () => {
    const bad = {
      payload: { ...signed.payload, products: ["blockyedu"] },
      signature: signed.signature,
    };
    const res = verifySignedLicense(bad, { [kid]: publicKeyPem });
    expect(res.ok).toBe(false);
  });

  it("denies offline grace by default (first install / no prior cache)", () => {
    const expired: LicensePayload = {
      ...payload,
      expiresAt: "2020-01-01T00:00:00.000Z",
      offlineGraceDays: 3650,
    };
    const signedExpired = signLocal(expired, privateKeyPem);
    const noGrace = verifySignedLicense(signedExpired, { [kid]: publicKeyPem });
    expect(noGrace.ok).toBe(false);
    if (!noGrace.ok) expect(noGrace.code).toBe("ENTITLEMENT_LICENSE_EXPIRED");

    const withGrace = verifySignedLicense(signedExpired, { [kid]: publicKeyPem }, {
      allowGrace: true,
      now: new Date("2020-01-02T00:00:00.000Z"),
    });
    expect(withGrace.ok).toBe(true);
    if (withGrace.ok) expect(withGrace.withinGrace).toBe(true);
  });

  it("EntitlementClient.verifyLicenseLocal exposes feature helpers and never bypasses Casbin", async () => {
    const client = new EntitlementClient({
      baseUrl: "http://unused",
      mode: "off",
      licensePublicKeys: { [kid]: publicKeyPem },
    });
    const res = await client.verifyLicenseLocal(signed, {
      productCode: "vistaremote",
      featureCode: "webrtc.sfu",
    });
    expect(res.ok).toBe(true);
    expect(res.casbinBypass).toBe(false);
    expect(res.featureAllowed("vistaremote", "webrtc.sfu")).toBe(true);
    expect(res.featureLimit("vistaremote", "device.limit")).toBe(10);
    expect(featureAllowed(res.payload, "vistaremote", "recording")).toBe(false);
    expect(featureLimit(res.payload, "vistaremote", "device.limit")).toBe(10);
  });
});
