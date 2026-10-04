import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_PLATFORM_TERMS_URL,
  buildLoginLegalDocuments,
  readLoginLegalConfigFromEnv,
} from "../dist/index.js";

test("login legal env prefers PUBLIC_ then falls back to LuminaryWorks defaults", () => {
  const urls = readLoginLegalConfigFromEnv({
    PUBLIC_LEGAL_PRODUCT_TERMS_URL: "https://remote.vistacast.dev/legal/terms",
  });
  assert.equal(urls.platformTermsUrl, DEFAULT_PLATFORM_TERMS_URL);
  assert.equal(urls.productTermsUrl, "https://remote.vistacast.dev/legal/terms");
  assert.equal(urls.productPrivacyUrl, "/legal/privacy");
});

test("login legal documents list product terms + privacy (platform incorporated by reference)", () => {
  const urls = readLoginLegalConfigFromEnv({
    VITE_LEGAL_PLATFORM_TERMS_URL: "https://lw.example/terms",
    VITE_LEGAL_PRODUCT_TERMS_URL: "/legal/terms",
    VITE_LEGAL_PRODUCT_PRIVACY_URL: "/legal/privacy",
  });
  assert.equal(urls.platformTermsUrl, "https://lw.example/terms");

  const docs = buildLoginLegalDocuments(urls, {
    platformTerms: "LuminaryWorks Terms",
    productTerms: "VistaRemote Terms",
    privacy: "Privacy",
  });
  assert.equal(docs.length, 2);
  assert.equal(docs[0].id, "product-terms");
  assert.equal(docs[0].href, "/legal/terms");
  assert.equal(docs[0].label, "VistaRemote Terms");
  assert.equal(docs[1].id, "privacy");
  assert.equal(docs[1].href, "/legal/privacy");
});
