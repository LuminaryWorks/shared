import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateRegisterUsername,
  isRegisterPasswordTooSimple,
  registerDuplicateFieldFromError,
  resolveRegisterEmailPolicy,
  evaluateRegisterEmailField,
} from "../dist/index.js";

test("evaluateRegisterUsername accepts Logto usernames and rejects email-like", () => {
  assert.equal(evaluateRegisterUsername("alice_01").ok, true);
  assert.equal(evaluateRegisterUsername("").ok, false);
  assert.equal(evaluateRegisterUsername("ab").ok, false);
  assert.equal(evaluateRegisterUsername("a".repeat(20)).ok, true);
  assert.equal(evaluateRegisterUsername("a".repeat(21)).ok, false);
  assert.equal(evaluateRegisterUsername("1alice").ok, false);
  assert.equal(evaluateRegisterUsername("alice@x.com").ok, false);
});

test("register passwords reject letters-only, sequences, and common values", () => {
  assert.equal(isRegisterPasswordTooSimple("password"), true);
  assert.equal(isRegisterPasswordTooSimple("12345678"), true);
  assert.equal(isRegisterPasswordTooSimple("abcdefg1"), true);
  assert.equal(isRegisterPasswordTooSimple("password1"), true);
  assert.equal(isRegisterPasswordTooSimple("aaaa1234"), true);
  assert.equal(isRegisterPasswordTooSimple("Summer26"), false);
});

test("evaluateRegisterEmailField applies allowlist policy", () => {
  const policy = resolveRegisterEmailPolicy({ mode: "allowlist" });
  assert.equal(evaluateRegisterEmailField("a@gmail.com", policy).ok, true);
  assert.equal(evaluateRegisterEmailField("", policy).ok, false);
  assert.equal(evaluateRegisterEmailField("a@not-allowed.example", policy).ok, false);
});

test("registerDuplicateFieldFromError maps Experience codes", () => {
  assert.equal(
    registerDuplicateFieldFromError({ code: "user.username_already_in_use", message: "x" }),
    "username",
  );
  assert.equal(
    registerDuplicateFieldFromError({ code: "user.email_already_in_use", message: "x" }),
    "email",
  );
  assert.equal(registerDuplicateFieldFromError(new Error("nope")), null);
});
