export const AI_PROVIDER_TYPES = [
  "deepseek",
  "qwen",
  "kimi",
  "mimo",
  "doubao",
  "openai",
  "openai-compatible",
  "anthropic",
  "gemini",
  "luminary-managed",
] as const;

export type AiProviderType = (typeof AI_PROVIDER_TYPES)[number];

export const AI_CONNECTION_OWNER_KINDS = ["user", "space", "organization", "deployment"] as const;
export type AiConnectionOwnerKind = (typeof AI_CONNECTION_OWNER_KINDS)[number];

export const AI_CONNECTION_PURPOSES = ["chat", "stt", "tts", "realtime"] as const;
export type AiConnectionPurpose = (typeof AI_CONNECTION_PURPOSES)[number] | string;
export type AiCapabilityRole = "stt" | "teaching_llm" | "tts" | "realtime_s2s";

export type AiMessageRole = "system" | "user" | "assistant";

export interface AiCompleteMessage {
  role: AiMessageRole;
  content: string;
}

export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface AiCompleteResult {
  text: string;
  parsed?: unknown;
  usage: AiUsage;
  model: string;
  providerType: AiProviderType | string;
  traceId: string;
}

export interface CompleteChatInput {
  connectionUid?: string;
  ephemeral?: {
    providerType: AiProviderType | string;
    baseUrl?: string;
    model: string;
    secret: string;
  };
  messages: AiCompleteMessage[];
  jsonSchema?: Record<string, unknown>;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface EmbedInput {
  texts: string[];
  model?: string;
  ephemeral?: CompleteChatInput["ephemeral"];
}

export interface EmbedResult {
  vectors: number[][];
  model: string;
  usage: AiUsage;
  traceId: string;
}

export interface AiUsageEvent {
  productCode: string;
  subjectId: string;
  organizationId?: string | null;
  conversationUid?: string;
  feature?: string;
  purpose?: "chat" | "stt" | "tts" | "realtime";
  providerType: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  audioInputMs?: number;
  audioOutputMs?: number;
  billed: "byok" | "managed";
  latencyMs?: number;
  firstTokenMs?: number;
  cacheHit?: boolean;
  routeTier?: string;
  estimatedCostMinor?: number;
  status?: string;
  traceId?: string;
  at: string;
}

export interface TranscribeInput {
  audio: Buffer;
  mime?: string;
  language?: string;
  model?: string;
  connectionUid?: string;
  ephemeral?: CompleteChatInput["ephemeral"];
  signal?: AbortSignal;
}

export interface TranscribeResult {
  text: string;
  model: string;
  providerType: string;
  traceId: string;
  audioInputMs?: number;
}

export interface SynthesizeInput {
  text: string;
  voice?: string;
  locale?: string;
  speed?: number;
  model?: string;
  connectionUid?: string;
  ephemeral?: CompleteChatInput["ephemeral"];
  signal?: AbortSignal;
}

export interface SynthesizeResult {
  audioBase64: string;
  mime: string;
  model: string;
  providerType: string;
  traceId: string;
  audioOutputMs?: number;
  cacheHit?: boolean;
}

export interface AssessSpeechInput {
  audio: Buffer;
  mime?: string;
  transcript?: string;
  connectionUid?: string;
  ephemeral?: CompleteChatInput["ephemeral"];
}

export interface AssessSpeechResult {
  scored: boolean;
  reason?: "not_supported" | "no_audio" | "provider_error";
  pronunciation?: number;
  providerType?: string;
  model?: string;
}

export interface AiClientOptions {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  onUsage?: (event: AiUsageEvent) => void | Promise<void>;
}

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; result: AiCompleteResult }
  | { type: "error"; message: string };

export interface AiConnectionPublic {
  uid: string;
  ownerKind?: AiConnectionOwnerKind;
  ownerUid?: string;
  providerType: string;
  displayName: string;
  baseUrl: string | null;
  model: string;
  secretFingerprint: string | null;
  enabled: boolean;
  isDefault: boolean;
  purpose: string | null;
  extra: Record<string, string> | null;
}

export interface AiProviderSettingsInput {
  providerType: AiProviderType | string;
  displayName: string;
  baseUrl?: string;
  model: string;
  secret?: string;
  enabled?: boolean;
  isDefault?: boolean;
  purpose?: string;
  extra?: Record<string, string>;
}

export interface AiProviderModelList {
  source: "live" | "catalog";
  models: string[];
}
