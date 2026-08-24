import { AI_PROVIDER_PRESETS } from "./catalog";
import { AI_PROVIDER_TYPES, type AiProviderModelList, type AiProviderType } from "./types";
import { resolveModelsUrl } from "./urls";

export const PROVIDER_CHAT_CATALOG: Record<AiProviderType, string[]> = Object.fromEntries(
  AI_PROVIDER_PRESETS.map((preset) => [preset.type, preset.suggestedModels]),
) as Record<AiProviderType, string[]>;

const NON_CHAT =
  /embed|whisper|tts|audio|realtime|image|dall-e|moderation|transcribe|search|sora|computer-use|codec|seedance|seedream|seed3d|seededit/i;

const DEAD_MODEL_STATUS = /^(shutdown|closed)$/i;

export function catalogModels(providerType: string): string[] {
  return PROVIDER_CHAT_CATALOG[providerType as AiProviderType] ?? [];
}

export function isMainstreamChatModel(providerType: string, id: string): boolean {
  const lower = id.trim().toLowerCase();
  if (!lower || NON_CHAT.test(lower)) return false;
  switch (providerType) {
    case "openai":
    case "openai-compatible":
      return /^(gpt-|o[1-9]|chatgpt-|omni)/i.test(lower);
    case "deepseek":
      return lower.startsWith("deepseek");
    case "qwen":
      return /^(qwen|qwq|qvq)/i.test(lower);
    case "kimi":
      return /^(kimi|moonshot)/i.test(lower);
    case "mimo":
      return lower.startsWith("mimo");
    case "anthropic":
      return lower.startsWith("claude");
    case "gemini":
      return lower.includes("gemini");
    case "doubao":
      if (lower.startsWith("ep-")) return true;
      return /^(doubao|deepseek|kimi)/i.test(lower);
    case "luminary-managed":
      return lower.startsWith("luminary");
    default:
      return true;
  }
}

export function filterLiveModels(providerType: string, ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = normalizeModelId(providerType, raw);
    if (!id || seen.has(id) || !isMainstreamChatModel(providerType, id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function mergeCatalogAndLive(catalog: string[], live: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of catalog) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  const extra = live.filter((id) => !seen.has(id)).sort((a, b) => a.localeCompare(b));
  for (const id of extra) {
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function normalizeModelId(providerType: string, raw: string): string {
  const trimmed = raw.trim();
  if (providerType === "gemini") {
    return trimmed.replace(/^models\//, "");
  }
  return trimmed;
}

export function parseOpenAiCompatibleModelIds(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  const ids: string[] = [];
  for (const item of data) {
    if (typeof item === "string" && item.trim()) {
      ids.push(item);
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const row = item as { id?: unknown; status?: unknown };
    if (typeof row.status === "string" && DEAD_MODEL_STATUS.test(row.status)) continue;
    if (typeof row.id === "string" && row.id.trim()) ids.push(row.id);
  }
  return ids;
}

export function parseGeminiModelIds(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const models = (body as { models?: unknown }).models;
  if (!Array.isArray(models)) return [];
  const ids: string[] = [];
  for (const item of models) {
    if (!item || typeof item !== "object") continue;
    const row = item as { name?: unknown; supportedGenerationMethods?: unknown };
    const methods = Array.isArray(row.supportedGenerationMethods)
      ? row.supportedGenerationMethods.filter(
          (method): method is string => typeof method === "string",
        )
      : [];
    if (methods.length > 0 && !methods.includes("generateContent")) continue;
    if (typeof row.name === "string" && row.name.trim()) ids.push(row.name);
  }
  return ids;
}

export function authHeadersForProvider(
  providerType: string,
  secret: string,
): Record<string, string> {
  if (providerType === "anthropic") {
    return {
      "Content-Type": "application/json",
      "x-api-key": secret,
      "anthropic-version": "2023-06-01",
    };
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${secret}`,
  };
  if (providerType === "mimo") {
    headers["api-key"] = secret;
  }
  return headers;
}

export async function fetchLiveModelIds(input: {
  providerType: string;
  baseUrl?: string | null;
  secret: string;
  timeoutMs?: number;
}): Promise<string[]> {
  const url = resolveModelsUrl(input.providerType, input.baseUrl);
  if (!url) return [];
  const signal = AbortSignal.timeout(input.timeoutMs ?? 8000);
  if (input.providerType === "gemini") {
    const res = await fetch(`${url}?key=${encodeURIComponent(input.secret)}`, { signal });
    const body: unknown = await res.json();
    if (!res.ok) {
      throw new Error(`Gemini list models failed ${res.status}`);
    }
    return parseGeminiModelIds(body);
  }
  const res = await fetch(url, {
    headers: authHeadersForProvider(input.providerType, input.secret),
    signal,
  });
  const body: unknown = await res.json();
  if (!res.ok) {
    throw new Error(`Provider list models failed ${res.status}`);
  }
  return parseOpenAiCompatibleModelIds(body);
}

export async function listProviderModels(input: {
  providerType: string;
  baseUrl?: string | null;
  secret?: string;
  timeoutMs?: number;
  onError?: (error: unknown) => void;
}): Promise<AiProviderModelList> {
  const catalog = catalogModels(input.providerType);
  const secret = input.secret?.trim();
  if (!secret || input.providerType === "luminary-managed") {
    return { source: "catalog", models: catalog };
  }
  try {
    const live = filterLiveModels(
      input.providerType,
      await fetchLiveModelIds({
        providerType: input.providerType,
        baseUrl: input.baseUrl,
        secret,
        timeoutMs: input.timeoutMs,
      }),
    );
    return {
      source: live.length > 0 ? "live" : "catalog",
      models: mergeCatalogAndLive(catalog, live),
    };
  } catch (error) {
    input.onError?.(error);
    return { source: "catalog", models: catalog };
  }
}

export function isKnownProviderType(type: string): type is AiProviderType {
  return (AI_PROVIDER_TYPES as readonly string[]).includes(type);
}
