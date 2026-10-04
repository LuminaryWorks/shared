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
});

test("ja, ko, and fr resolve card copy", () => {
  assert.equal(normalizeLoginLocale("ja-JP"), "ja");
  assert.equal(normalizeLoginLocale("fr-FR"), "fr");
  assert.equal(loginLabels("ja").title, "ログイン");
  assert.equal(loginLabels("ko").consentRequired, "계속하려면 약관에 동의하세요.");
  assert.equal(loginLabels("fr").consentRequired, "Acceptez les conditions avant de continuer.");
});
