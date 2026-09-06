import assert from "node:assert/strict";
import test from "node:test";
import { ttsCacheKey } from "../dist/speech.js";

test("TTS cache key is stable for normalized text", () => {
  const a = ttsCacheKey({
    providerType: "openai",
    model: "tts-1",
    voice: "alloy",
    locale: "en",
    speed: 1,
    text: "Good  job!",
  });
  const b = ttsCacheKey({
    providerType: "openai",
    model: "tts-1",
    voice: "alloy",
    locale: "en",
    speed: 1,
    text: " Good job! ",
  });
  const c = ttsCacheKey({
    providerType: "openai",
    model: "tts-1",
    voice: "nova",
    locale: "en",
    speed: 1,
    text: "Good job!",
  });
  assert.equal(a, b);
  assert.notEqual(a, c);
});
