import assert from "node:assert/strict";
import test from "node:test";
import { mergeModelOptions, MODEL_FORM_LABELS, resolveTranslate } from "../dist/helpers.js";

test("mergeModelOptions keeps the current id first", () => {
  assert.deepEqual(mergeModelOptions(["b", "a"], "a"), ["a", "b"]);
  assert.deepEqual(mergeModelOptions(["b"], "custom"), ["custom", "b"]);
});

test("resolveTranslate falls back to bundled zh labels", () => {
  const t = resolveTranslate();
  assert.equal(t("ai.provider"), "提供商");
  assert.equal(MODEL_FORM_LABELS["ai.secret"], "API Key");
});

test("resolveTranslate prefers product t() when provided", () => {
  const t = resolveTranslate((key) => (key === "ai.provider" ? "Provider" : key));
  assert.equal(t("ai.provider"), "Provider");
});
