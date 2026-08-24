import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  canRefreshProviderModels,
  connectionHasPurpose,
  fieldsForProvider,
  formHasUserInput,
  getProviderPreset,
  hasMultipleBaseUrls,
  isProviderFormReadyForTest,
  parsePurposes,
  pickDefaultModel,
  serializePurposes,
  showPurposeSelect,
  supportedPurposesOf,
} from "../dist/catalog.js";
import {
  catalogModels,
  filterLiveModels,
  mergeCatalogAndLive,
  parseGeminiModelIds,
  parseOpenAiCompatibleModelIds,
} from "../dist/models.js";
import { resolveChatCompletionsUrl, resolveModelsUrl } from "../dist/urls.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("catalog entry does not pull node:crypto", () => {
  const source = readFileSync(join(root, "dist/catalog.js"), "utf8");
  assert.equal(source.includes("node:crypto"), false);
  assert.equal(source.includes("./vault"), false);
});

test("catalog lists official OpenAI, Gemini, Qwen, Kimi, MiMo, Doubao ids", () => {
  assert.ok(getProviderPreset("openai")?.suggestedModels.includes("gpt-5.6"));
  assert.ok(getProviderPreset("gemini")?.suggestedModels.includes("gemini-3.1-pro-preview"));
  assert.equal(getProviderPreset("qwen")?.suggestedModels[0], "qwen-plus");
  assert.equal(getProviderPreset("kimi")?.suggestedModels[0], "kimi-k3");
  assert.equal(getProviderPreset("mimo")?.suggestedModels[0], "mimo-v2.5-pro");
  assert.equal(getProviderPreset("doubao")?.suggestedModels[0], "doubao-seed-2-1-pro-260628");
  assert.equal(hasMultipleBaseUrls(getProviderPreset("qwen")), true);
  assert.equal(hasMultipleBaseUrls(getProviderPreset("deepseek")), false);
});

test("form helpers match DataView defaults", () => {
  const preset = getProviderPreset("openai");
  assert.deepEqual(fieldsForProvider(preset), {
    displayName: "OpenAI",
    model: "gpt-5.6",
    baseUrl: "https://api.openai.com",
    secret: "",
    purpose: "",
  });
  assert.equal(
    formHasUserInput(
      { displayName: "DeepSeek", model: "deepseek-chat", baseUrl: "https://api.deepseek.com" },
      getProviderPreset("deepseek"),
    ),
    false,
  );
  assert.equal(
    isProviderFormReadyForTest(
      { providerType: "deepseek", displayName: "DeepSeek", model: "deepseek-chat", secret: "sk" },
      getProviderPreset("deepseek"),
      false,
    ),
    true,
  );
  assert.equal(canRefreshProviderModels({ secret: "sk-test" }), true);
  assert.equal(canRefreshProviderModels({ hasSavedSecret: true }), true);
  assert.equal(canRefreshProviderModels({ hasSavedSecret: true, requiresBaseUrl: true }), false);
  assert.equal(pickDefaultModel(["gpt-5.6", "gpt-4o"], "gpt-4o"), "gpt-4o");
});

test("purpose is multi-select only when the vendor supports more than chat", () => {
  assert.equal(showPurposeSelect(getProviderPreset("deepseek")), false);
  assert.equal(showPurposeSelect(getProviderPreset("anthropic")), false);
  assert.equal(showPurposeSelect(getProviderPreset("openai")), true);
  assert.deepEqual(supportedPurposesOf(getProviderPreset("qwen")), ["chat", "stt", "tts"]);
  assert.equal(serializePurposes(["stt", "chat", "chat"]), "stt,chat");
  assert.deepEqual(parsePurposes("chat, stt"), ["chat", "stt"]);
  assert.equal(connectionHasPurpose("chat,stt", "chat"), true);
  assert.equal(connectionHasPurpose("stt", "chat"), false);
  assert.equal(connectionHasPurpose(null, "chat"), true);
});

test("list-model helpers keep catalog first and drop non-chat ids", () => {
  assert.ok(catalogModels("openai").includes("gpt-5.6"));
  assert.deepEqual(
    filterLiveModels("openai", ["gpt-5.6", "text-embedding-3-small", "whisper-1"]),
    ["gpt-5.6"],
  );
  assert.deepEqual(mergeCatalogAndLive(["gpt-5.6", "gpt-4o"], ["gpt-4o", "gpt-5.4", "o3"]), [
    "gpt-5.6",
    "gpt-4o",
    "gpt-5.4",
    "o3",
  ]);
  assert.deepEqual(parseOpenAiCompatibleModelIds({ data: [{ id: "gpt-5.6" }, { id: "o3" }] }), [
    "gpt-5.6",
    "o3",
  ]);
  assert.deepEqual(
    parseGeminiModelIds({
      models: [
        { name: "models/gemini-2.5-pro", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-embedding-001", supportedGenerationMethods: ["embedContent"] },
      ],
    }),
    ["models/gemini-2.5-pro"],
  );
});

test("chat and models URLs match DataTalk roots", () => {
  assert.equal(
    resolveChatCompletionsUrl("doubao", null),
    "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
  );
  assert.equal(
    resolveChatCompletionsUrl("deepseek", null),
    "https://api.deepseek.com/v1/chat/completions",
  );
  assert.equal(
    resolveChatCompletionsUrl("qwen", null),
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  );
  assert.equal(resolveModelsUrl("openai", null), "https://api.openai.com/v1/models");
  assert.equal(resolveModelsUrl("anthropic", null), "https://api.anthropic.com/v1/models");
  assert.equal(
    resolveModelsUrl("gemini", null),
    "https://generativelanguage.googleapis.com/v1beta/models",
  );
  assert.equal(resolveModelsUrl("openai-compatible", null), null);
  assert.equal(
    resolveModelsUrl("openai-compatible", "http://localhost:11434/v1"),
    "http://localhost:11434/v1/models",
  );
});

test("package exports catalog without loading vault", () => {
  const require = createRequire(import.meta.url);
  const catalog = require("../dist/catalog.js");
  assert.equal(typeof catalog.getProviderPreset, "function");
  assert.equal(catalog.encryptSecret, undefined);
});
