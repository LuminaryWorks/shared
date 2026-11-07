import assert from "node:assert/strict";
import test from "node:test";
import {
  AI_PLATFORM_ERROR_CODES,
  isAiPlatformErrorCode,
  validateChatRequestV2,
  validateSpeechAssessRequest,
} from "../dist/contract-v2.js";

const policy = {
  productCode: "blockyedu",
  allowedCapabilities: ["chat.text", "chat.code", "speech.assess"],
  defaultTier: {
    "chat.text": "economy",
    "chat.code": "standard",
    "chat.reasoning": "premium",
    embed: "economy",
    stt: "economy",
    tts: "economy",
    "voice.turn": "standard",
    "speech.assess": "standard",
    "image.generate": "premium",
    "vision.understand": "premium",
  },
  userSelectable: [
    {
      capability: "chat.text",
      options: [{ label: "Fast", routeId: "route-fast", multiplier: 1 }],
    },
  ],
  contentSafety: "k12",
  logPrompts: false,
};

function validBody(overrides = {}) {
  return {
    capability: "chat.text",
    tier: "economy",
    messages: [{ role: "user", content: "hello" }],
    maxTokens: 32,
    productCode: "blockyedu",
    subjectId: "stu-1",
    idempotencyKey: "idem-1",
    ...overrides,
  };
}

test("stable error codes match spec §8", () => {
  assert.deepEqual(AI_PLATFORM_ERROR_CODES, [
    "AUTH_REQUIRED",
    "ENTITLEMENT_DENIED",
    "INSUFFICIENT_CREDITS",
    "MODEL_NOT_ALLOWED",
    "CAPABILITY_NOT_ENABLED",
    "ROUTE_UNAVAILABLE",
    "CONTENT_BLOCKED",
    "RATE_LIMITED",
    "PROVIDER_ERROR",
    "IDEMPOTENCY_CONFLICT",
    "PUBLIC_API_DISABLED",
  ]);
  assert.equal(isAiPlatformErrorCode("AUTH_REQUIRED"), true);
  assert.equal(isAiPlatformErrorCode("VALIDATION_ERROR"), false);
});

test("chat v2 requires maxTokens and idempotencyKey", () => {
  const missingTokens = validateChatRequestV2(validBody({ maxTokens: undefined }), policy);
  assert.equal(missingTokens.ok, false);
  assert.equal(missingTokens.code, "VALIDATION_ERROR");

  const missingKey = validateChatRequestV2(validBody({ idempotencyKey: "  " }), policy);
  assert.equal(missingKey.ok, false);
  assert.equal(missingKey.code, "VALIDATION_ERROR");

  const ok = validateChatRequestV2(validBody(), policy);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.maxTokens, 32);
  assert.equal(ok.value.idempotencyKey, "idem-1");
});

test("routeId must belong to the product allowedModels", () => {
  const denied = validateChatRequestV2(validBody({ routeId: "route-other" }), policy);
  assert.equal(denied.ok, false);
  assert.equal(denied.code, "MODEL_NOT_ALLOWED");

  const unknownProduct = validateChatRequestV2(validBody({ routeId: "route-fast" }));
  assert.equal(unknownProduct.ok, false);
  assert.equal(unknownProduct.code, "MODEL_NOT_ALLOWED");

  const allowed = validateChatRequestV2(validBody({ routeId: "route-fast" }), policy);
  assert.equal(allowed.ok, true);
  assert.equal(allowed.value.routeId, "route-fast");
});

test("capability outside the product policy is CAPABILITY_NOT_ENABLED", () => {
  const result = validateChatRequestV2(validBody({ capability: "vision.understand" }), policy);
  assert.equal(result.ok, false);
  assert.equal(result.code, "CAPABILITY_NOT_ENABLED");
});

test("content parts and tools are accepted when well formed", () => {
  const result = validateChatRequestV2(
    validBody({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "look" },
            { type: "image", url: "https://example.test/a.png", mime: "image/png" },
          ],
        },
      ],
      tools: [{ name: "lookup", description: "Lookup", parameters: { type: "object" } }],
      toolChoice: "auto",
    }),
    policy,
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.tools[0].name, "lookup");
});

test("speech assess request requires its contract fields", () => {
  const missing = validateSpeechAssessRequest({ audioBase64: "abc" });
  assert.equal(missing.ok, false);
  const ok = validateSpeechAssessRequest({
    audioBase64: "abc",
    mime: "audio/wav",
    referenceText: "hello",
    locale: "en-US",
    productCode: "blockyedu",
    subjectId: "stu-1",
    idempotencyKey: "idem-s",
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.referenceText, "hello");
});
