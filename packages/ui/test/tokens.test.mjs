import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { luminaryAntToken, luminaryColors } from "../dist/tokens.js";
import { errorMessageKey, readApiError } from "../dist/api-error.js";

const brand = readFileSync(new URL("../../../brand/ant-theme.ts", import.meta.url), "utf8");

test("brand tokens match shared/brand/ant-theme.ts", () => {
  for (const hex of Object.values(luminaryColors)) {
    assert.ok(brand.includes(hex), hex);
  }
  assert.equal(luminaryAntToken.colorPrimary, "#1677ff");
  assert.equal(luminaryAntToken.colorSuccess, luminaryColors.success);
  assert.equal(luminaryAntToken.colorWarning, luminaryColors.warning);
  assert.equal(luminaryAntToken.colorError, luminaryColors.danger);
  assert.equal(luminaryAntToken.borderRadius, 8);
  assert.match(brand, /borderRadius:\s*8/);
});

test("readApiError only accepts status and code", () => {
  assert.equal(readApiError(null), null);
  assert.equal(readApiError(new Error("boom")), null);
  assert.deepEqual(readApiError({ status: 403, code: "FORBIDDEN", message: "no" }), {
    status: 403,
    code: "FORBIDDEN",
    message: "no",
  });
  const error = new Error("denied");
  error.status = 401;
  error.code = "UNAUTHORIZED";
  assert.equal(readApiError(error)?.message, "denied");
  assert.equal(errorMessageKey(401), "unauthorized");
  assert.equal(errorMessageKey(402), "paymentRequired");
  assert.equal(errorMessageKey(403), "forbidden");
  assert.equal(errorMessageKey(500), "generic");
});
