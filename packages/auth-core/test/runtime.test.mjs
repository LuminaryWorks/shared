import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  createRuntimeIdentityProvider,
  DefaultRuntimeClaimsResolver,
  DEFAULT_LOGTO_CLAIMS_PRESET,
  LegacyRuntimeIdentityProvider,
  LogtoRuntimeIdentityProvider,
  LuminaryAuthService,
  OidcRuntimeIdentityProvider,
} from "../dist/index.js";

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signLegacy(payload, secret) {
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}`;
  const signature = createHmac("sha256", secret).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

test("claims resolver keys external identities by issuer and subject", () => {
  const resolver = new DefaultRuntimeClaimsResolver();
  const context = {
    providerKind: "logto",
    issuer: "https://identity.example.test/oidc",
    preset: DEFAULT_LOGTO_CLAIMS_PRESET,
  };

  const first = resolver.resolve(
    {
      sub: "user-1",
      iss: "https://tenant-a.example.test",
      roles: ["admin"],
      permissions: "documents:read documents:write",
      org_id: "org-1",
      app_access: ["data_luminary", "doer_flow"],
    },
    context,
  );
  const second = resolver.resolve(
    { sub: "user-1", iss: "https://tenant-b.example.test" },
    context,
  );

  assert.deepEqual(first.externalIdentityKey, {
    issuer: "https://tenant-a.example.test",
    subject: "user-1",
  });
  assert.notDeepEqual(first.externalIdentityKey, second.externalIdentityKey);
  assert.equal(first.subject, first.sub);
  assert.equal(first.issuer, first.iss);
  assert.deepEqual(first.permissions, ["documents:read", "documents:write"]);
  assert.deepEqual(first.appAccess, ["data_luminary", "doer_flow"]);
  assert.equal(first.orgId, "org-1");
  assert.equal(first.organizationId, "org-1");
});

test("built-in runtime selection keeps existing modes", () => {
  assert.ok(
    createRuntimeIdentityProvider({
      mode: "logto",
      issuer: "https://identity.example.test/oidc",
    }) instanceof LogtoRuntimeIdentityProvider,
  );
  assert.ok(
    createRuntimeIdentityProvider({
      mode: "external_oidc",
      issuer: "https://identity.example.test",
    }) instanceof OidcRuntimeIdentityProvider,
  );
});

test("legacy runtime returns a principal with an issuer-qualified key", async () => {
  const secret = "test-secret";
  const provider = new LegacyRuntimeIdentityProvider(secret);
  const principal = await provider.verifyToken(
    signLegacy(
      {
        sub: "legacy-user",
        name: "Legacy User",
        roles: ["admin"],
        orgId: "legacy-org",
        appAccess: ["data_luminary"],
      },
      secret,
    ),
  );

  assert.equal(principal.providerKind, "legacy");
  assert.equal(principal.subject, "legacy-user");
  assert.equal(principal.issuer, "urn:luminaryworks:legacy");
  assert.equal(principal.organizationId, "legacy-org");
  assert.deepEqual(principal.appAccess, ["data_luminary"]);
  assert.deepEqual(principal.externalIdentityKey, {
    issuer: "urn:luminaryworks:legacy",
    subject: "legacy-user",
  });
  assert.equal(principal.name, "Legacy User");
});

test("auth service keeps the compatible payload and rawToken contract", async () => {
  const runtimeProvider = {
    kind: "company_oidc",
    async verifyToken() {
      return {
        sub: "user-2",
        subject: "user-2",
        iss: "https://company.example.test",
        issuer: "https://company.example.test",
        name: "Runtime User",
        providerKind: this.kind,
        externalIdentityKey: {
          issuer: "https://company.example.test",
          subject: "user-2",
        },
      };
    },
  };
  const service = new LuminaryAuthService({ runtimeProvider });
  const user = await service.verifyToken("opaque-token");

  assert.equal(user.sub, "user-2");
  assert.equal(user.name, "Runtime User");
  assert.equal(user.rawToken, "opaque-token");
  assert.equal(service.isOidcMode(), true);
});
