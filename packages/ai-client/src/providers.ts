import type { AiCompleteMessage, AiCompleteResult, AiProviderType, AiUsage } from "./types";

const DEFAULT_BASE: Record<string, string> = {
  deepseek: "https://api.deepseek.com",
  openai: "https://api.openai.com",
  doubao: "https://ark.cn-beijing.volces.com/api/v3",
  "openai-compatible": "",
  anthropic: "https://api.anthropic.com",
  gemini: "https://generativelanguage.googleapis.com",
};

export function resolveChatUrl(providerType: string, baseUrl?: string): string {
  const root = (baseUrl || DEFAULT_BASE[providerType] || "").replace(/\/$/, "");
  if (providerType === "gemini") {
    return `${root || DEFAULT_BASE.gemini}/v1beta/openai/chat/completions`;
  }
  if (!root) throw new Error("openai-compatible provider requires baseUrl");
  if (root.endsWith("/chat/completions")) return root;
  return `${root}/chat/completions`;
}

function extractText(body: {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
}): string {
  const content = body.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((p) => p.text ?? "").join("");
  return "";
}

export async function completeLocal(input: {
  providerType: string;
  baseUrl?: string;
  model: string;
  secret: string;
  messages: AiCompleteMessage[];
  jsonMode?: boolean;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<AiCompleteResult> {
  const traceId = `trc_${Date.now().toString(36)}`;
  if (input.providerType === "anthropic") {
    return completeAnthropic(input, traceId);
  }
  const url = resolveChatUrl(input.providerType, input.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    signal: input.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.secret}`,
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      max_tokens: input.maxTokens,
      temperature: 0.3,
      response_format:
        input.jsonMode && input.providerType !== "doubao"
          ? { type: "json_object" }
          : undefined,
    }),
  });
  const body = (await res.json()) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    model?: string;
  };
  if (!res.ok) {
    throw new Error(body.error?.message || `Provider error ${res.status}`);
  }
  const usage: AiUsage = {
    promptTokens: body.usage?.prompt_tokens ?? 0,
    completionTokens: body.usage?.completion_tokens ?? 0,
  };
  return {
    text: extractText(body),
    usage,
    model: body.model || input.model,
    providerType: input.providerType as AiProviderType,
    traceId,
  };
}

async function completeAnthropic(
  input: {
    baseUrl?: string;
    model: string;
    secret: string;
    messages: AiCompleteMessage[];
    maxTokens?: number;
    signal?: AbortSignal;
  },
  traceId: string,
): Promise<AiCompleteResult> {
  const root = (input.baseUrl || DEFAULT_BASE.anthropic).replace(/\/$/, "");
  const system = input.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const messages = input.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));
  const res = await fetch(`${root}/v1/messages`, {
    method: "POST",
    signal: input.signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": input.secret,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: input.maxTokens ?? 1024,
      system: system || undefined,
      messages,
    }),
  });
  const body = (await res.json()) as {
    error?: { message?: string };
    content?: Array<{ text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  if (!res.ok) throw new Error(body.error?.message || `Anthropic error ${res.status}`);
  return {
    text: body.content?.[0]?.text ?? "",
    usage: {
      promptTokens: body.usage?.input_tokens ?? 0,
      completionTokens: body.usage?.output_tokens ?? 0,
    },
    model: input.model,
    providerType: "anthropic",
    traceId,
  };
}

export async function* streamLocal(input: {
  providerType: string;
  baseUrl?: string;
  model: string;
  secret: string;
  messages: AiCompleteMessage[];
  signal?: AbortSignal;
}): AsyncGenerator<{ type: "delta"; text: string } | { type: "done"; result: AiCompleteResult }> {
  const url = resolveChatUrl(input.providerType, input.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    signal: input.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.secret}`,
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      stream: true,
      temperature: 0.3,
    }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text();
    throw new Error(text.slice(0, 300) || `Stream error ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let promptTokens = 0;
  let completionTokens = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const delta = json.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          full += delta;
          yield { type: "delta", text: delta };
        }
        if (json.usage) {
          promptTokens = json.usage.prompt_tokens ?? promptTokens;
          completionTokens = json.usage.completion_tokens ?? completionTokens;
        }
      } catch {
        /* ignore keep-alive */
      }
    }
  }
  yield {
    type: "done",
    result: {
      text: full,
      usage: { promptTokens, completionTokens },
      model: input.model,
      providerType: input.providerType,
      traceId: `trc_${Date.now().toString(36)}`,
    },
  };
}
