/**
 * Live register + sign-in against local Logto.
 * The verification code is read from the identity database, not from email.
 * Skips when Logto or its database container is not running.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { describe, test } from "node:test";
import { LogtoExperienceAdapter } from "../dist/index.js";

const LOGTO = process.env.AUTH_REACT_LIVE_LOGTO || "http://localhost:3001";
const CLIENT_ID = process.env.AUTH_REACT_LIVE_CLIENT_ID || "dct48edzxf9c2jufb9cbs";
const REDIRECT_URI = process.env.AUTH_REACT_LIVE_REDIRECT || "http://localhost:3003/auth/callback";
const DB_CONTAINER = process.env.AUTH_REACT_LIVE_DB_CONTAINER || "luminary-identity-db";

function logtoReachable() {
  return fetch(`${LOGTO}/oidc/.well-known/openid-configuration`, {
    signal: AbortSignal.timeout(800),
  })
    .then((res) => res.ok)
    .catch(() => false);
}

function dbReady() {
  try {
    execFileSync(
      "docker",
      ["exec", DB_CONTAINER, "psql", "-U", "logto", "-d", "logto", "-t", "-A", "-c", "SELECT 1"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return true;
  } catch {
    return false;
  }
}

function psql(sql) {
  return execFileSync(
    "docker",
    ["exec", DB_CONTAINER, "psql", "-U", "logto", "-d", "logto", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { encoding: "utf8" },
  ).trim();
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function installCookieJar() {
  const cookies = new Map();
  const original = globalThis.fetch;
  const absorb = (res) => {
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const pair = raw.split(";")[0] ?? "";
      const index = pair.indexOf("=");
      if (index <= 0) continue;
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (value) cookies.set(name, value);
      else cookies.delete(name);
    }
  };
  globalThis.fetch = async (url, init = {}) => {
    const headers = new Headers(init.headers);
    if (cookies.size) headers.set("cookie", [...cookies].map(([key, value]) => `${key}=${value}`).join("; "));
    const res = await original(url, { ...init, headers });
    absorb(res);
    return res;
  };
  return {
    restore() {
      globalThis.fetch = original;
    },
    async authorize(origin = LOGTO) {
      const verifier = randomBytes(32).toString("base64url");
      const challenge = createHash("sha256").update(verifier).digest("base64url");
      const url = new URL("/oidc/auth", origin);
      url.searchParams.set("client_id", CLIENT_ID);
      url.searchParams.set("redirect_uri", REDIRECT_URI);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid profile email");
      url.searchParams.set("state", randomBytes(8).toString("hex"));
      url.searchParams.set("code_challenge", challenge);
      url.searchParams.set("code_challenge_method", "S256");
      url.searchParams.set("prompt", "login");
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 300 || res.status >= 400) {
        throw new Error(`authorize ${res.status}`);
      }
      return verifier;
    },
  };
}

async function followAuthorizationCode(startUrl) {
  let current = startUrl;
  for (let hop = 0; hop < 8; hop += 1) {
    const url = new URL(current);
    if (url.origin + url.pathname === new URL(REDIRECT_URI).origin + new URL(REDIRECT_URI).pathname) {
      const code = url.searchParams.get("code");
      if (!code) throw new Error(`callback missing code: ${current}`);
      return code;
    }
    const res = await fetch(current, { redirect: "manual" });
    if (res.status < 300 || res.status >= 400) {
      const text = await res.text();
      throw new Error(`oidc hop ${res.status} ${current} ${text.slice(0, 180)}`);
    }
    const location = res.headers.get("location");
    if (!location) throw new Error(`oidc hop missing location ${current}`);
    current = new URL(location, current).toString();
  }
  throw new Error(`oidc redirect did not reach ${REDIRECT_URI}`);
}

async function exchangeCode(code, verifier) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: verifier,
  });
  const res = await fetch(`${LOGTO}/oidc/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`token ${res.status} ${text.slice(0, 240)}`);
  const json = JSON.parse(text);
  if (!json.access_token) throw new Error("token response missing access_token");
  return json;
}

function latestPasscode(email) {
  const row = psql(
    `SELECT code || '|' || consumed::text FROM passcodes WHERE tenant_id = 'default' AND email = ${quote(email)} AND type = 'Register' ORDER BY created_at DESC LIMIT 1`,
  );
  const [code, consumed] = row.split("|");
  return { code, consumed };
}

function deleteSmokeUser(email, username) {
  psql(`DELETE FROM passcodes WHERE tenant_id = 'default' AND email = ${quote(email)}`);
  psql(
    `DELETE FROM users WHERE tenant_id = 'default' AND (primary_email = ${quote(email)} OR username = ${quote(username)})`,
  );
}

async function liveReady() {
  return (await logtoReachable()) && dbReady();
}

describe("live Logto register and sign-in", { concurrency: 1 }, () => {
test("register retries a taken username without burning the code, then signs in", async (t) => {
  if (!(await logtoReachable()) || !dbReady()) {
    t.skip("local Logto is not running");
    return;
  }

  const stamp = Date.now().toString(36);
  const email = `lw-auth-smoke-${stamp}@example.com`;
  const username = `lwsmoke${stamp}`;
  const password = `Smoke${stamp}aA1`;
  const takenUsername = "andyzhou";
  const adapter = new LogtoExperienceAdapter();
  adapter.emailPolicy = { mode: "off", allowlist: [], blocklist: [] };
  const jar = installCookieJar();
  const session = {
    apiBase: LOGTO,
    issuer: `${LOGTO}/oidc`,
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
  };

  try {
    const registerVerifier = await jar.authorize();
    const sent = await adapter.sendRegisterEmailCode({ ...session, email, identifier: email });
    assert.ok(sent.verificationId);

    const passcode = psql(
      `SELECT code || '|' || consumed::text FROM passcodes WHERE tenant_id = 'default' AND email = ${quote(email)} AND type = 'Register' ORDER BY created_at DESC LIMIT 1`,
    );
    const [code, consumedBefore] = passcode.split("|");
    assert.equal(code?.length, 6);
    assert.equal(consumedBefore, "false");

    await assert.rejects(
      () =>
        adapter.experienceEmailPasswordSignUp({
          ...session,
          email,
          username: takenUsername,
          password,
          code,
          verificationId: sent.verificationId,
        }),
      (error) => error instanceof Error && /username_already_in_use|already in use/i.test(`${error.code ?? ""} ${error.message}`),
    );

    const consumedAfterReject = psql(
      `SELECT consumed::text FROM passcodes WHERE tenant_id = 'default' AND email = ${quote(email)} AND type = 'Register' ORDER BY created_at DESC LIMIT 1`,
    );
    assert.equal(consumedAfterReject, "false");

    const registered = await adapter.experienceEmailPasswordSignUp({
      ...session,
      email,
      username,
      password,
      code,
      verificationId: sent.verificationId,
    });
    assert.ok(registered.redirectTo);
    const registerCode = await followAuthorizationCode(registered.redirectTo);
    const registerToken = await exchangeCode(registerCode, registerVerifier);
    assert.equal(typeof registerToken.access_token, "string");

    const emailVerifier = await jar.authorize();
    const emailSignIn = await adapter.experiencePasswordSignIn({
      ...session,
      identifier: email,
      password,
    });
    assert.ok(emailSignIn.redirectTo);
    assert.equal(emailSignIn.mfaRequired, undefined);
    const emailCode = await followAuthorizationCode(emailSignIn.redirectTo);
    await exchangeCode(emailCode, emailVerifier);

    const usernameVerifier = await jar.authorize();
    const usernameSignIn = await adapter.experiencePasswordSignIn({
      ...session,
      identifier: username,
      password,
    });
    assert.ok(usernameSignIn.redirectTo);
    const usernameCode = await followAuthorizationCode(usernameSignIn.redirectTo);
    await exchangeCode(usernameCode, usernameVerifier);
  } finally {
    jar.restore();
    try {
      psql(`DELETE FROM passcodes WHERE tenant_id = 'default' AND email = ${quote(email)}`);
      psql(
        `DELETE FROM users WHERE tenant_id = 'default' AND (primary_email = ${quote(email)} OR username = ${quote(username)})`,
      );
    } catch {
      /* leave the row if a foreign key blocks cleanup */
    }
  }
});

test("wrong code, short password, and a blocked domain do not consume a usable code", async (t) => {
  if (!(await liveReady())) {
    t.skip("local Logto is not running");
    return;
  }
  const stamp = Date.now().toString(36);
  const email = `lw-auth-edge-${stamp}@example.com`;
  const username = `lwedge${stamp}`;
  const password = `Smoke${stamp}aA1`;
  const adapter = new LogtoExperienceAdapter();
  adapter.emailPolicy = { mode: "off", allowlist: [], blocklist: [] };
  const jar = installCookieJar();
  const session = {
    apiBase: LOGTO,
    issuer: `${LOGTO}/oidc`,
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
  };
  try {
    await jar.authorize();
    const blocked = new LogtoExperienceAdapter();
    await assert.rejects(
      () =>
        blocked.sendRegisterEmailCode({
          ...session,
          email: `${"a".repeat(250)}@example.com`,
          identifier: `${"a".repeat(250)}@example.com`,
        }),
      /valid email|64|characters/i,
    );

    const sent = await adapter.sendRegisterEmailCode({ ...session, email, identifier: email });
    const { code, consumed } = latestPasscode(email);
    assert.equal(code.length, 6);
    assert.equal(consumed, "false");

    await assert.rejects(
      () =>
        adapter.experienceEmailPasswordSignUp({
          ...session,
          email,
          username,
          password: "short1",
          code,
          verificationId: sent.verificationId,
        }),
      /at least 8 characters/,
    );
    assert.equal(latestPasscode(email).consumed, "false");

    await assert.rejects(
      () =>
        adapter.experienceEmailPasswordSignUp({
          ...session,
          email,
          username,
          password,
          code: "000000",
          verificationId: sent.verificationId,
        }),
      /code|verification/i,
    );
    assert.equal(latestPasscode(email).consumed, "false");

    const registered = await adapter.experienceEmailPasswordSignUp({
      ...session,
      email,
      username,
      password,
      code,
      verificationId: sent.verificationId,
    });
    assert.ok(registered.redirectTo);
  } finally {
    jar.restore();
    try {
      deleteSmokeUser(email, username);
    } catch {
      /* cleanup is best-effort */
    }
  }
});

test("resend issues a new code and a second registration of the same email is rejected", async (t) => {
  if (!(await liveReady())) {
    t.skip("local Logto is not running");
    return;
  }
  const stamp = Date.now().toString(36);
  const email = `lw-auth-resend-${stamp}@example.com`;
  const username = `lwresend${stamp}`;
  const password = `Smoke${stamp}aA1`;
  const adapter = new LogtoExperienceAdapter();
  adapter.emailPolicy = { mode: "off", allowlist: [], blocklist: [] };
  const jar = installCookieJar();
  const session = {
    apiBase: LOGTO,
    issuer: `${LOGTO}/oidc`,
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
  };
  try {
    const verifier = await jar.authorize();
    const first = await adapter.sendRegisterEmailCode({ ...session, email, identifier: email });
    const firstCode = latestPasscode(email).code;
    const second = await adapter.sendRegisterEmailCode({ ...session, email, identifier: email });
    const secondCode = latestPasscode(email).code;
    assert.notEqual(second.verificationId, first.verificationId);
    assert.equal(secondCode.length, 6);

    await assert.rejects(
      () =>
        adapter.experienceEmailPasswordSignUp({
          ...session,
          email,
          username,
          password,
          code: firstCode,
          verificationId: second.verificationId,
        }),
      /code|verification/i,
    );

    const registered = await adapter.experienceEmailPasswordSignUp({
      ...session,
      email,
      username,
      password,
      code: secondCode,
      verificationId: second.verificationId,
    });
    const authCode = await followAuthorizationCode(registered.redirectTo);
    await exchangeCode(authCode, verifier);

    await jar.authorize();
    let duplicateRejected = false;
    try {
      const again = await adapter.sendRegisterEmailCode({ ...session, email, identifier: email });
      const againCode = latestPasscode(email).code;
      await adapter.experienceEmailPasswordSignUp({
        ...session,
        email,
        username: `${username}b`,
        password,
        code: againCode,
        verificationId: again.verificationId,
      });
    } catch (error) {
      duplicateRejected = /email_already_in_use|already in use|already registered/i.test(
        `${error instanceof Error ? error.message : ""} ${error && typeof error === "object" && "code" in error ? error.code : ""}`,
      );
      if (!duplicateRejected) throw error;
    }
    assert.equal(duplicateRejected, true);
    const count = psql(
      `SELECT count(*) FROM users WHERE tenant_id = 'default' AND primary_email = ${quote(email)}`,
    );
    assert.equal(count, "1");
  } finally {
    jar.restore();
    try {
      deleteSmokeUser(email, username);
      deleteSmokeUser(email, `${username}b`);
    } catch {
      /* cleanup is best-effort */
    }
  }
});

test("wrong password and an unknown account do not sign in", async (t) => {
  if (!(await liveReady())) {
    t.skip("local Logto is not running");
    return;
  }
  const stamp = Date.now().toString(36);
  const email = `lw-auth-login-${stamp}@example.com`;
  const username = `lwlogin${stamp}`;
  const password = `Smoke${stamp}aA1`;
  const adapter = new LogtoExperienceAdapter();
  adapter.emailPolicy = { mode: "off", allowlist: [], blocklist: [] };
  const jar = installCookieJar();
  const session = {
    apiBase: LOGTO,
    issuer: `${LOGTO}/oidc`,
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
  };
  try {
    const verifier = await jar.authorize();
    const sent = await adapter.sendRegisterEmailCode({ ...session, email, identifier: email });
    const { code } = latestPasscode(email);
    const registered = await adapter.experienceEmailPasswordSignUp({
      ...session,
      email,
      username,
      password,
      code,
      verificationId: sent.verificationId,
    });
    await exchangeCode(await followAuthorizationCode(registered.redirectTo), verifier);

    await jar.authorize();
    await assert.rejects(
      () => adapter.experiencePasswordSignIn({ ...session, identifier: email, password: `${password}!` }),
      /password|invalid|credential|not exist|sign-in failed/i,
    );

    await jar.authorize();
    await assert.rejects(
      () =>
        adapter.experiencePasswordSignIn({
          ...session,
          identifier: `missing${stamp}@example.com`,
          password,
        }),
      /password|invalid|credential|not exist|sign-in failed/i,
    );

    const okVerifier = await jar.authorize();
    const ok = await adapter.experiencePasswordSignIn({ ...session, identifier: username, password });
    await exchangeCode(await followAuthorizationCode(ok.redirectTo), okVerifier);
  } finally {
    jar.restore();
    try {
      deleteSmokeUser(email, username);
    } catch {
      /* cleanup is best-effort */
    }
  }
});

test("register and sign-in through the DataView experience proxy", async (t) => {
  if (!(await liveReady())) {
    t.skip("local Logto is not running");
    return;
  }
  const spa = "http://localhost:3003";
  const spaUp = await fetch(spa, { signal: AbortSignal.timeout(800) }).then((res) => res.ok).catch(() => false);
  if (!spaUp) {
    t.skip("DataView is not running");
    return;
  }
  const stamp = Date.now().toString(36);
  const email = `lw-auth-proxy-${stamp}@example.com`;
  const username = `lwproxy${stamp}`;
  const password = `Smoke${stamp}aA1`;
  const adapter = new LogtoExperienceAdapter();
  adapter.emailPolicy = { mode: "off", allowlist: [], blocklist: [] };
  const jar = installCookieJar();
  const session = {
    apiBase: spa,
    issuer: `${LOGTO}/oidc`,
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
  };
  try {
    const verifier = await jar.authorize(spa);
    const sent = await adapter.sendRegisterEmailCode({ ...session, email, identifier: email });
    const { code } = latestPasscode(email);
    const registered = await adapter.experienceEmailPasswordSignUp({
      ...session,
      email,
      username,
      password,
      code,
      verificationId: sent.verificationId,
    });
    assert.ok(registered.redirectTo.startsWith(spa), registered.redirectTo);
    await exchangeCode(await followAuthorizationCode(registered.redirectTo), verifier);

    const loginVerifier = await jar.authorize(spa);
    const signedIn = await adapter.experiencePasswordSignIn({ ...session, identifier: email, password });
    assert.ok(signedIn.redirectTo.startsWith(spa));
    await exchangeCode(await followAuthorizationCode(signedIn.redirectTo), loginVerifier);
  } finally {
    jar.restore();
    try {
      deleteSmokeUser(email, username);
    } catch {
      /* cleanup is best-effort */
    }
  }
});
});
