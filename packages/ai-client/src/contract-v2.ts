/**
 * AI capability routing contract v2.
 * Shapes follow spec/ai-capability-routing.md §2–§4, §7, and §8.
 * v1 types in ./types stay unchanged.
 */

export const AI_CAPABILITIES = [
  "chat.text",
  "chat.code",
  "chat.reasoning",
  "embed",
  "stt",
  "tts",
  "voice.turn",
  "speech.assess",
  "image.generate",
  "vision.understand",
] as const;

export type Capability = (typeof AI_CAPABILITIES)[number];

export const AI_TIERS = ["economy", "standard", "premium"] as const;
export type Tier = (typeof AI_TIERS)[number];

/** Stable platform error codes (spec/ai-capability-routing.md §8). */
export const AI_PLATFORM_ERROR_CODES = [
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
] as const;

export type AiPlatformErrorCode = (typeof AI_PLATFORM_ERROR_CODES)[number];

/** Body-shape failures. Not part of the stable §8 set. */
export const AI_REQUEST_VALIDATION_ERROR = "VALIDATION_ERROR" as const;

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; url?: string; base64?: string; mime?: string }
  | { type: "audio"; base64: string; mime: string };

export interface ChatToolCallV2 {
  id: string;
  name: string;
  arguments: string;
}

export interface ChatMessageV2 {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[];
  toolCalls?: ChatToolCallV2[];
  toolCallId?: string;
}

export interface ChatToolV2 {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatRequestV2 {
  capability: "chat.text" | "chat.code" | "chat.reasoning" | "vision.understand";
  tier?: Tier;
  /** Must belong to the product allowedModels (userSelectable route ids). */
  routeId?: string;
  messages: ChatMessageV2[];
  tools?: ChatToolV2[];
  toolChoice?: "auto" | "none" | { name: string };
  responseFormat?: { type: "json_schema"; schema: Record<string, unknown>; strict?: boolean };
  /** Required at runtime. Upper bound used to reserve credits. */
  maxTokens?: number;
  cache?: { prefixKey?: string };
  productCode: string;
  subjectId: string;
  organizationId?: string;
  feature?: string;
  conversationUid?: string;
  idempotencyKey: string;
}

export interface RouteCandidate {
  providerType: string;
  model: string;
  /** Connection uid inside the platform vault. */
  connectionUid: string;
  /** Lower runs first. */
  priority: number;
  enabled: boolean;
  /** Maintained from health probes and recent error rate. */
  healthy: boolean;
}

export interface Route {
  id: string;
  capability: Capability;
  tier: Tier;
  candidates: RouteCandidate[];
  fallbackPolicy: "next_candidate" | "fail";
  latencyBudgetMs?: number;
  rateCardId: string;
}

export interface ProductAiPolicy {
  productCode: "blockyedu" | "dataluminary" | "vistacast" | string;
  allowedCapabilities: Capability[];
  defaultTier: Record<Capability, Tier>;
  userSelectable?: Array<{
    capability: Capability;
    options: Array<{ label: string; routeId: string; multiplier: number }>;
  }>;
  contentSafety: "none" | "standard" | "k12";
  /** D-AI-17: always false. The platform does not store prompt bodies. */
  logPrompts: false;
  perUserDailyCreditCap?: number;
}

export interface SpeechAssessRequest {
  audioBase64: string;
  mime: string;
  referenceText: string;
  locale: string;
  productCode: string;
  subjectId: string;
  idempotencyKey: string;
}

export interface SpeechAssessWord {
  word: string;
  score: number;
  phonemes?: Array<{ ipa: string; score: number }>;
}

export interface SpeechAssessResult {
  /** 0–100 */
  overall: number;
  accuracy?: number;
  fluency?: number;
  completeness?: number;
  prosody?: number;
  words: SpeechAssessWord[];
  providerType: string;
  model: string;
}

const CHAT_CAPABILITIES = ["chat.text", "chat.code", "chat.reasoning", "vision.understand"] as const;
type ChatCapability = (typeof CHAT_CAPABILITIES)[number];

export type ChatRequestValidation =
  | { ok: true; value: ChatRequestV2 }
  | { ok: false; code: AiPlatformErrorCode | typeof AI_REQUEST_VALIDATION_ERROR; message: string };

export function isAiPlatformErrorCode(value: string): value is AiPlatformErrorCode {
  return (AI_PLATFORM_ERROR_CODES as readonly string[]).includes(value);
}

export function validateChatRequestV2(input: unknown, policy?: ProductAiPolicy): ChatRequestValidation {
  if (!isRecord(input)) return fail("Request body must be an object");

  const capability = input.capability;
  if (!isChatCapability(capability)) {
    return fail("capability must be chat.text, chat.code, chat.reasoning, or vision.understand");
  }

  if (input.tier !== undefined && !isTier(input.tier)) {
    return fail("tier must be economy, standard, or premium");
  }

  const messages = parseMessages(input.messages);
  if (!messages.ok) return messages;

  if (!isPositiveInt(input.maxTokens)) {
    return fail("maxTokens is required and must be a positive integer");
  }

  if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.trim() === "") {
    return fail("idempotencyKey is required");
  }

  if (typeof input.productCode !== "string" || input.productCode.trim() === "") {
    return fail("productCode is required");
  }

  if (typeof input.subjectId !== "string" || input.subjectId.trim() === "") {
    return fail("subjectId is required");
  }

  if (input.organizationId !== undefined && typeof input.organizationId !== "string") {
    return fail("organizationId must be a string");
  }
  if (input.feature !== undefined && typeof input.feature !== "string") {
    return fail("feature must be a string");
  }
  if (input.conversationUid !== undefined && typeof input.conversationUid !== "string") {
    return fail("conversationUid must be a string");
  }
  if (input.routeId !== undefined && typeof input.routeId !== "string") {
    return fail("routeId must be a string");
  }

  const tools = parseTools(input.tools);
  if (!tools.ok) return tools;
  const toolChoice = parseToolChoice(input.toolChoice);
  if (!toolChoice.ok) return toolChoice;
  const responseFormat = parseResponseFormat(input.responseFormat);
  if (!responseFormat.ok) return responseFormat;
  const cache = parseCache(input.cache);
  if (!cache.ok) return cache;

  if (policy && !policy.allowedCapabilities.includes(capability)) {
    return {
      ok: false,
      code: "CAPABILITY_NOT_ENABLED",
      message: `capability ${capability} is not enabled for ${policy.productCode}`,
    };
  }

  const routeId = typeof input.routeId === "string" ? input.routeId.trim() : "";
  if (routeId) {
    const options =
      policy?.userSelectable?.find((entry) => entry.capability === capability)?.options ?? [];
    const allowed = options.some((option) => option.routeId === routeId);
    if (!allowed) {
      return {
        ok: false,
        code: "MODEL_NOT_ALLOWED",
        message: "routeId is not in the product allowedModels",
      };
    }
  }

  const value: ChatRequestV2 = {
    capability,
    messages: messages.value,
    maxTokens: input.maxTokens,
    productCode: input.productCode,
    subjectId: input.subjectId,
    idempotencyKey: input.idempotencyKey,
  };
  if (input.tier !== undefined && isTier(input.tier)) value.tier = input.tier;
  if (routeId) value.routeId = routeId;
  if (tools.value) value.tools = tools.value;
  if (toolChoice.value !== undefined) value.toolChoice = toolChoice.value;
  if (responseFormat.value) value.responseFormat = responseFormat.value;
  if (cache.value) value.cache = cache.value;
  if (typeof input.organizationId === "string") value.organizationId = input.organizationId;
  if (typeof input.feature === "string") value.feature = input.feature;
  if (typeof input.conversationUid === "string") value.conversationUid = input.conversationUid;
  return { ok: true, value };
}

export type SpeechAssessValidation =
  | { ok: true; value: SpeechAssessRequest }
  | { ok: false; code: typeof AI_REQUEST_VALIDATION_ERROR; message: string };

export function validateSpeechAssessRequest(input: unknown): SpeechAssessValidation {
  if (!isRecord(input)) return { ok: false, code: AI_REQUEST_VALIDATION_ERROR, message: "Request body must be an object" };
  const fields = [
    "audioBase64",
    "mime",
    "referenceText",
    "locale",
    "productCode",
    "subjectId",
    "idempotencyKey",
  ] as const;
  for (const field of fields) {
    const value = input[field];
    if (typeof value !== "string" || value.trim() === "") {
      return { ok: false, code: AI_REQUEST_VALIDATION_ERROR, message: `${field} is required` };
    }
  }
  return {
    ok: true,
    value: {
      audioBase64: input.audioBase64 as string,
      mime: input.mime as string,
      referenceText: input.referenceText as string,
      locale: input.locale as string,
      productCode: input.productCode as string,
      subjectId: input.subjectId as string,
      idempotencyKey: input.idempotencyKey as string,
    },
  };
}

function fail(message: string): ChatRequestValidation {
  return { ok: false, code: AI_REQUEST_VALIDATION_ERROR, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isChatCapability(value: unknown): value is ChatCapability {
  return typeof value === "string" && (CHAT_CAPABILITIES as readonly string[]).includes(value);
}

function isTier(value: unknown): value is Tier {
  return value === "economy" || value === "standard" || value === "premium";
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function parseMessages(
  value: unknown,
): { ok: true; value: ChatMessageV2[] } | { ok: false; code: typeof AI_REQUEST_VALIDATION_ERROR; message: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, code: AI_REQUEST_VALIDATION_ERROR, message: "messages must be a non-empty array" };
  }
  const messages: ChatMessageV2[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) {
      return { ok: false, code: AI_REQUEST_VALIDATION_ERROR, message: "each message must be an object" };
    }
    if (
      entry.role !== "system" &&
      entry.role !== "user" &&
      entry.role !== "assistant" &&
      entry.role !== "tool"
    ) {
      return { ok: false, code: AI_REQUEST_VALIDATION_ERROR, message: "message.role is invalid" };
    }
    const content = parseContent(entry.content);
    if (!content.ok) return content;
    const message: ChatMessageV2 = { role: entry.role, content: content.value };
    if (entry.toolCallId !== undefined) {
      if (typeof entry.toolCallId !== "string") {
        return { ok: false, code: AI_REQUEST_VALIDATION_ERROR, message: "toolCallId must be a string" };
      }
      message.toolCallId = entry.toolCallId;
    }
    if (entry.toolCalls !== undefined) {
      if (!Array.isArray(entry.toolCalls)) {
        return { ok: false, code: AI_REQUEST_VALIDATION_ERROR, message: "toolCalls must be an array" };
      }
      const toolCalls: ChatToolCallV2[] = [];
      for (const call of entry.toolCalls) {
        if (!isRecord(call) || typeof call.id !== "string" || typeof call.name !== "string" || typeof call.arguments !== "string") {
          return {
            ok: false,
            code: AI_REQUEST_VALIDATION_ERROR,
            message: "toolCalls entries require id, name, and arguments strings",
          };
        }
        toolCalls.push({ id: call.id, name: call.name, arguments: call.arguments });
      }
      message.toolCalls = toolCalls;
    }
    messages.push(message);
  }
  return { ok: true, value: messages };
}

function parseContent(
  value: unknown,
): { ok: true; value: string | ContentPart[] } | { ok: false; code: typeof AI_REQUEST_VALIDATION_ERROR; message: string } {
  if (typeof value === "string") return { ok: true, value };
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, code: AI_REQUEST_VALIDATION_ERROR, message: "message.content must be a string or content parts" };
  }
  const parts: ContentPart[] = [];
  for (const part of value) {
    const parsed = parseContentPart(part);
    if (!parsed.ok) return parsed;
    parts.push(parsed.value);
  }
  return { ok: true, value: parts };
}

function parseContentPart(
  value: unknown,
): { ok: true; value: ContentPart } | { ok: false; code: typeof AI_REQUEST_VALIDATION_ERROR; message: string } {
  if (!isRecord(value)) {
    return { ok: false, code: AI_REQUEST_VALIDATION_ERROR, message: "content part must be an object" };
  }
  if (value.type === "text") {
    if (typeof value.text !== "string") {
      return { ok: false, code: AI_REQUEST_VALIDATION_ERROR, message: "text content part requires text" };
    }
    return { ok: true, value: { type: "text", text: value.text } };
  }
  if (value.type === "image") {
    const url = typeof value.url === "string" ? value.url : undefined;
    const base64 = typeof value.base64 === "string" ? value.base64 : undefined;
    if (!url && !base64) {
      return { ok: false, code: AI_REQUEST_VALIDATION_ERROR, message: "image content part requires url or base64" };
    }
    if (value.mime !== undefined && typeof value.mime !== "string") {
      return { ok: false, code: AI_REQUEST_VALIDATION_ERROR, message: "image mime must be a string" };
    }
    const part: ContentPart = { type: "image" };
    if (url) part.url = url;
    if (base64) part.base64 = base64;
    if (typeof value.mime === "string") part.mime = value.mime;
    return { ok: true, value: part };
  }
  if (value.type === "audio") {
    if (typeof value.base64 !== "string" || typeof value.mime !== "string") {
      return { ok: false, code: AI_REQUEST_VALIDATION_ERROR, message: "audio content part requires base64 and mime" };
    }
    return { ok: true, value: { type: "audio", base64: value.base64, mime: value.mime } };
  }
  return { ok: false, code: AI_REQUEST_VALIDATION_ERROR, message: "content part type is invalid" };
}

function parseTools(
  value: unknown,
): { ok: true; value?: ChatToolV2[] } | { ok: false; code: typeof AI_REQUEST_VALIDATION_ERROR; message: string } {
  if (value === undefined) return { ok: true };
  if (!Array.isArray(value)) {
    return { ok: false, code: AI_REQUEST_VALIDATION_ERROR, message: "tools must be an array" };
  }
  const tools: ChatToolV2[] = [];
  for (const tool of value) {
    if (!isRecord(tool) || typeof tool.name !== "string" || typeof tool.description !== "string" || !isRecord(tool.parameters)) {
      return {
        ok: false,
        code: AI_REQUEST_VALIDATION_ERROR,
        message: "tools entries require name, description, and parameters",
      };
    }
    tools.push({ name: tool.name, description: tool.description, parameters: tool.parameters });
  }
  return { ok: true, value: tools };
}

function parseToolChoice(
  value: unknown,
):
  | { ok: true; value?: ChatRequestV2["toolChoice"] }
  | { ok: false; code: typeof AI_REQUEST_VALIDATION_ERROR; message: string } {
  if (value === undefined) return { ok: true };
  if (value === "auto" || value === "none") return { ok: true, value };
  if (isRecord(value) && typeof value.name === "string") return { ok: true, value: { name: value.name } };
  return { ok: false, code: AI_REQUEST_VALIDATION_ERROR, message: "toolChoice is invalid" };
}

function parseResponseFormat(
  value: unknown,
):
  | { ok: true; value?: ChatRequestV2["responseFormat"] }
  | { ok: false; code: typeof AI_REQUEST_VALIDATION_ERROR; message: string } {
  if (value === undefined) return { ok: true };
  if (!isRecord(value) || value.type !== "json_schema" || !isRecord(value.schema)) {
    return { ok: false, code: AI_REQUEST_VALIDATION_ERROR, message: "responseFormat must be json_schema" };
  }
  if (value.strict !== undefined && typeof value.strict !== "boolean") {
    return { ok: false, code: AI_REQUEST_VALIDATION_ERROR, message: "responseFormat.strict must be a boolean" };
  }
  return {
    ok: true,
    value: {
      type: "json_schema",
      schema: value.schema,
      ...(typeof value.strict === "boolean" ? { strict: value.strict } : {}),
    },
  };
}

function parseCache(
  value: unknown,
): { ok: true; value?: { prefixKey?: string } } | { ok: false; code: typeof AI_REQUEST_VALIDATION_ERROR; message: string } {
  if (value === undefined) return { ok: true };
  if (!isRecord(value)) return { ok: false, code: AI_REQUEST_VALIDATION_ERROR, message: "cache must be an object" };
  if (value.prefixKey !== undefined && typeof value.prefixKey !== "string") {
    return { ok: false, code: AI_REQUEST_VALIDATION_ERROR, message: "cache.prefixKey must be a string" };
  }
  return { ok: true, value: typeof value.prefixKey === "string" ? { prefixKey: value.prefixKey } : {} };
}
