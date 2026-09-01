import assert from "node:assert/strict";
import test from "node:test";
import {
  createLoginExperienceAdapter,
  HostedOidcExperienceAdapter,
  LOGIN_EXPERIENCE_CAPABILITIES,
  LogtoExperienceAdapter,
  readIdpConfigFromEnv,
  resolveLoginExperienceAdapter,
} from "../dist/index.js";

test("login factory defaults to Logto Headless and maps ZITADEL to hosted OIDC", () => {
  const logto = createLoginExperienceAdapter();
  assert.ok(logto instanceof LogtoExperienceAdapter);
  assert.equal(logto.provider, "logto");
  assert.ok(logto.capabilities.includes(LOGIN_EXPERIENCE_CAPABILITIES.passwordSignIn));

  const hosted = createLoginExperienceAdapter("hosted");
  assert.ok(hosted instanceof HostedOidcExperienceAdapter);
  assert.deepEqual(hosted.capabilities, []);

  const zitadel = createLoginExperienceAdapter("zitadel");
  assert.ok(zitadel instanceof HostedOidcExperienceAdapter);
  assert.equal(zitadel.provider, "zitadel");
  assert.equal(zitadel.capabilities.length, 0);
  assert.equal(resolveLoginExperienceAdapter(null, "zitadel").provider, "zitadel");
  assert.throws(() => createLoginExperienceAdapter("casdoor"), /Unknown login experience provider/);
});

test("readIdpConfigFromEnv carries IAM_PROVIDER for the login panel", () => {
  const config = readIdpConfigFromEnv({
    VITE_IDP_ISSUER: "http://localhost:3001/oidc",
    VITE_IDP_CLIENT_ID: "spa",
    VITE_IDP_REDIRECT_URI: "http://localhost:3000/auth/callback",
    VITE_IAM_PROVIDER: "zitadel",
  });
  assert.equal(config.iamProvider, "zitadel");
});
