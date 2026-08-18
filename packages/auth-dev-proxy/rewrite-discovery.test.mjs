import assert from "node:assert/strict";
import { test } from "node:test";
import { rewriteOidcDiscoveryJson } from "./dist/index.js";

const spa = "http://localhost:18082";
const logto = "http://localhost:3001";

test("pins authorize back to Logto when upstream used X-Forwarded-Host SPA origin", () => {
  const input = JSON.stringify({
    issuer: `${logto}/oidc`,
    authorization_endpoint: `${spa}/oidc/auth`,
    device_authorization_endpoint: `${spa}/oidc/device/auth`,
    pushed_authorization_request_endpoint: `${spa}/oidc/request`,
    token_endpoint: `${logto}/oidc/token`,
    jwks_uri: `${logto}/oidc/jwks`,
  });
  const out = JSON.parse(
    rewriteOidcDiscoveryJson(input, { spaOrigin: spa, logtoOrigin: logto }),
  );
  assert.equal(out.issuer, `${logto}/oidc`);
  assert.equal(out.authorization_endpoint, `${logto}/oidc/auth`);
  assert.equal(out.device_authorization_endpoint, `${logto}/oidc/device/auth`);
  assert.equal(out.pushed_authorization_request_endpoint, `${logto}/oidc/request`);
  assert.equal(out.token_endpoint, `${spa}/oidc/token`);
  assert.equal(out.jwks_uri, `${spa}/oidc/jwks`);
});

test("keeps Logto authorize when discovery is already correct", () => {
  const input = JSON.stringify({
    issuer: `${logto}/oidc`,
    authorization_endpoint: `${logto}/oidc/auth`,
    token_endpoint: `${logto}/oidc/token`,
  });
  const out = JSON.parse(
    rewriteOidcDiscoveryJson(input, { spaOrigin: spa, logtoOrigin: logto }),
  );
  assert.equal(out.authorization_endpoint, `${logto}/oidc/auth`);
  assert.equal(out.token_endpoint, `${spa}/oidc/token`);
});
