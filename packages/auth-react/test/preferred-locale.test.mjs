import assert from "node:assert/strict";
import { test } from "node:test";
import { matchSupportedLocale, resolvePreferredLocale } from "../dist/index.js";

test("saved ja is not overridden by an English browser", () => {
  assert.equal(
    resolvePreferredLocale({
      stored: "ja",
      languages: ["en-US"],
      timeZone: "Asia/Shanghai",
    }),
    "ja",
  );
});

test("Chinese script tags map onto zh-CN and zh-TW", () => {
  assert.equal(matchSupportedLocale("zh"), "zh-CN");
  assert.equal(matchSupportedLocale("zh-Hans"), "zh-CN");
  assert.equal(matchSupportedLocale("zh-TW"), "zh-TW");
  assert.equal(matchSupportedLocale("zh-HK"), "zh-TW");
  assert.equal(matchSupportedLocale("zh-Hant"), "zh-TW");
});

test("language list uses the first supported tag", () => {
  assert.equal(
    resolvePreferredLocale({
      languages: ["de-DE", "fr-FR", "en-US"],
      timeZone: "Asia/Tokyo",
    }),
    "fr",
  );
});

test("time zone is used only when no supported language matched", () => {
  assert.equal(
    resolvePreferredLocale({
      languages: ["de"],
      timeZone: "Asia/Tokyo",
    }),
    "ja",
  );
  assert.equal(
    resolvePreferredLocale({
      languages: ["en-US"],
      timeZone: "Asia/Shanghai",
    }),
    "en",
  );
});

test("unknown language and time zone fall back to English", () => {
  assert.equal(resolvePreferredLocale({}), "en");
  assert.equal(
    resolvePreferredLocale({ languages: ["de-DE"], timeZone: "Europe/Berlin" }),
    "en",
  );
});
