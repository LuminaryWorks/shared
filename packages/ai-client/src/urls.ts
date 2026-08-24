const ARK_DEFAULT_ROOT = "https://ark.cn-beijing.volces.com/api/v3";

const OPENAI_COMPAT_DEFAULT_ROOT: Record<string, string> = {
  deepseek: "https://api.deepseek.com",
  openai: "https://api.openai.com",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  kimi: "https://api.moonshot.cn/v1",
  mimo: "https://api.xiaomimimo.com/v1",
};

/** Resolve OpenAI-compatible chat URL. Doubao Ark uses /api/v3/chat/completions, not /v1. */
export function resolveChatCompletionsUrl(
  providerType: string,
  baseUrl?: string | null,
): string | null {
  const trimmed = (baseUrl ?? "").trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) {
    return trimmed;
  }

  if (providerType === "doubao") {
    return `${normalizeArkRoot(trimmed)}/chat/completions`;
  }

  if (providerType === "gemini") {
    const root = (trimmed || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
    if (root.endsWith("/chat/completions")) return root;
    if (root.includes("/v1beta/openai")) {
      return root.endsWith("/chat/completions") ? root : `${root}/chat/completions`;
    }
    return `${root}/v1beta/openai/chat/completions`;
  }

  if (providerType === "anthropic") {
    const root = trimmed || "https://api.anthropic.com";
    return `${root.replace(/\/$/, "")}/v1/messages`;
  }

  const root = trimmed || OPENAI_COMPAT_DEFAULT_ROOT[providerType] || "";
  if (!root) return null;

  const suffix = "/v1/chat/completions";
  if (root.endsWith("/v1")) {
    return `${root}${suffix.slice(3)}`;
  }
  return `${root}${suffix}`;
}

/** List-models URL for the same provider root as chat completions. */
export function resolveModelsUrl(providerType: string, baseUrl?: string | null): string | null {
  const trimmed = (baseUrl ?? "").trim().replace(/\/+$/, "");
  if (providerType === "anthropic") {
    return `${trimmed || "https://api.anthropic.com"}/v1/models`;
  }
  if (providerType === "gemini") {
    return `${trimmed || "https://generativelanguage.googleapis.com"}/v1beta/models`;
  }
  if (providerType === "luminary-managed") return null;
  const chat = resolveChatCompletionsUrl(providerType, baseUrl);
  if (!chat?.endsWith("/chat/completions")) return null;
  return `${chat.slice(0, -"/chat/completions".length)}/models`;
}

function normalizeArkRoot(baseUrl: string): string {
  if (!baseUrl) return ARK_DEFAULT_ROOT;
  if (baseUrl.endsWith("/api/v3") || baseUrl.endsWith("/api/coding")) return baseUrl;
  if (/^https?:\/\/ark\.[^/]+\.(volces|bytepluses)\.com$/i.test(baseUrl)) {
    return `${baseUrl}/api/v3`;
  }
  return baseUrl;
}

export function defaultProviderBaseUrl(providerType: string): string {
  if (providerType === "doubao") return ARK_DEFAULT_ROOT;
  if (providerType === "gemini") return "https://generativelanguage.googleapis.com";
  if (providerType === "anthropic") return "https://api.anthropic.com";
  return OPENAI_COMPAT_DEFAULT_ROOT[providerType] ?? "";
}
