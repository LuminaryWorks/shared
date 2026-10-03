import assert from "node:assert/strict";
import { test } from "node:test";
import { loginLabels, normalizeLoginLocale } from "../dist/index.js";

test("zh and zh-CN share simplified card copy", () => {
  assert.equal(normalizeLoginLocale("zh"), "zh-CN");
  assert.equal(loginLabels("zh-CN").submitPassword, "密码登录");
  assert.equal(loginLabels("zh").identifierPlaceholder, "邮箱或用户名");
});

test("zh-TW and es differ from English defaults", () => {
  assert.equal(loginLabels("zh-TW").title, "登入");
  assert.equal(loginLabels("es").registerLink, "Crear una cuenta");
  assert.deepEqual(loginLabels("en"), {});
  assert.deepEqual(loginLabels("ja"), {});
});
