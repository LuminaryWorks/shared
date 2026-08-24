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

export const AI_CONNECTION_PURPOSES = ["chat", "stt", "tts"] as const;
export type AiConnectionPurpose = (typeof AI_CONNECTION_PURPOSES)[number] | string;

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
  providerType: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  billed: "byok" | "managed";
  latencyMs?: number;
  firstTokenMs?: number;
  status?: string;
  traceId?: string;
  at: string;
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
