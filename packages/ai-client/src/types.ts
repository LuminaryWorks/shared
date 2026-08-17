export type AiProviderType =
  | "deepseek"
  | "doubao"
  | "openai"
  | "openai-compatible"
  | "anthropic"
  | "gemini"
  | "luminary-managed";

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
