import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateRegisterEmail,
  normalizeRegisterEmailMode,
  registerEmailRejectionMessage,
  resolveRegisterEmailPolicy,
} from "../dist/index.js";

test("register email allowlist accepts consumer providers and rejects games/disposable", () => {
  const policy = resolveRegisterEmailPolicy({ mode: "allowlist" });
  assert.equal(evaluateRegisterEmail("a@gmail.com", policy).ok, true);
  assert.equal(evaluateRegisterEmail("a@qq.com", policy).ok, true);
  assert.equal(evaluateRegisterEmail("a@outlook.com", policy).ok, true);
  assert.equal(evaluateRegisterEmail("a@163.com", policy).ok, true);
  assert.equal(evaluateRegisterEmail("bot@mailinator.com", policy).ok, false);
  assert.equal(evaluateRegisterEmail("x@random-game-mail.xyz", policy).ok, false);
  assert.match(
    registerEmailRejectionMessage(evaluateRegisterEmail("x@evil.zzz", policy)),
    /not accepted/i,
  );
});

test("register email mode off still blocks disposable hosts", () => {
  const policy = resolveRegisterEmailPolicy({ mode: "off" });
  assert.equal(normalizeRegisterEmailMode("off"), "off");
  assert.equal(evaluateRegisterEmail("a@corp.example", policy).ok, true);
  assert.equal(evaluateRegisterEmail("a@yopmail.com", policy).ok, false);
});

test("formatAllowedEmailDomains lists allowlist for the register hint", async () => {
  const { formatAllowedEmailDomains, registerEmailDomainsHint } = await import("../dist/index.js");
  const policy = resolveRegisterEmailPolicy({
    mode: "allowlist",
    allowlist: ["gmail.com", "qq.com", "outlook.com"],
  });
  assert.equal(formatAllowedEmailDomains(policy), "gmail.com, qq.com, outlook.com");
  assert.match(registerEmailDomainsHint(policy) || "", /Allowed email domains: gmail\.com/);
  assert.equal(formatAllowedEmailDomains(resolveRegisterEmailPolicy({ mode: "off" })), null);
});
