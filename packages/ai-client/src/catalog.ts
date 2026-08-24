import type { AiProviderType } from "./types";

export interface AiProviderBaseUrlOption {
  value: string;
  labelKey: string;
  defaultLabel: string;
}

export interface AiProviderPreset {
  type: AiProviderType;
  labelKey: string;
  defaultLabel: string;
  defaultBaseUrl: string;
  suggestedBaseUrls?: AiProviderBaseUrlOption[];
  suggestedModels: string[];
  requiresBaseUrl: boolean;
  secretRequired: boolean;
  availabilityHintKey?: string;
  /**
   * Capabilities this vendor actually exposes. Default `["chat"]`.
   * The purpose field is shown only when more than one value is listed.
   */
  supportedPurposes?: string[];
}

export const AI_PROVIDER_PRESETS: AiProviderPreset[] = [
  {
    type: "deepseek",
    labelKey: "ai.provider.deepseek",
    defaultLabel: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com",
    suggestedModels: ["deepseek-chat", "deepseek-reasoner"],
    requiresBaseUrl: false,
    secretRequired: true,
  },
  {
    type: "qwen",
    labelKey: "ai.provider.qwen",
    defaultLabel: "阿里千问 / 百炼",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    suggestedBaseUrls: [
      {
        value: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        labelKey: "ai.baseUrl.qwen.beijing",
        defaultLabel: "北京",
      },
      {
        value: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        labelKey: "ai.baseUrl.qwen.singapore",
        defaultLabel: "新加坡",
      },
      {
        value: "https://dashscope-us.aliyuncs.com/compatible-mode/v1",
        labelKey: "ai.baseUrl.qwen.virginia",
        defaultLabel: "美国（弗吉尼亚）",
      },
      {
        value: "https://cn-hongkong.dashscope.aliyuncs.com/compatible-mode/v1",
        labelKey: "ai.baseUrl.qwen.hongkong",
        defaultLabel: "中国香港",
      },
    ],
    suggestedModels: [
      "qwen-plus",
      "qwen-flash",
      "qwen-turbo",
      "qwen-max",
      "qwen3-max",
      "qwen3.8-max",
      "qwen3.7-plus",
    ],
    requiresBaseUrl: false,
    secretRequired: true,
    supportedPurposes: ["chat", "stt", "tts"],
  },
  {
    type: "kimi",
    labelKey: "ai.provider.kimi",
    defaultLabel: "Kimi",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    suggestedBaseUrls: [
      {
        value: "https://api.moonshot.cn/v1",
        labelKey: "ai.baseUrl.kimi.cn",
        defaultLabel: "国内",
      },
      {
        value: "https://api.moonshot.ai/v1",
        labelKey: "ai.baseUrl.kimi.international",
        defaultLabel: "国际",
      },
      {
        value: "https://api.kimi.com/coding/v1",
        labelKey: "ai.baseUrl.kimi.coding",
        defaultLabel: "Kimi Code Plan",
      },
    ],
    suggestedModels: ["kimi-k3", "kimi-k2.6", "kimi-k2.7-code", "kimi-k2.7-code-highspeed"],
    requiresBaseUrl: false,
    secretRequired: true,
  },
  {
    type: "mimo",
    labelKey: "ai.provider.mimo",
    defaultLabel: "小米 MiMo",
    defaultBaseUrl: "https://api.xiaomimimo.com/v1",
    suggestedBaseUrls: [
      {
        value: "https://api.xiaomimimo.com/v1",
        labelKey: "ai.baseUrl.mimo.payg",
        defaultLabel: "按量计费",
      },
      {
        value: "https://token-plan-cn.xiaomimimo.com/v1",
        labelKey: "ai.baseUrl.mimo.tokenCn",
        defaultLabel: "Token 套餐 · 国内",
      },
      {
        value: "https://token-plan-sgp.xiaomimimo.com/v1",
        labelKey: "ai.baseUrl.mimo.tokenSgp",
        defaultLabel: "Token 套餐 · 新加坡",
      },
      {
        value: "https://token-plan-ams.xiaomimimo.com/v1",
        labelKey: "ai.baseUrl.mimo.tokenAms",
        defaultLabel: "Token 套餐 · 欧洲",
      },
    ],
    suggestedModels: ["mimo-v2.5-pro", "mimo-v2.5"],
    requiresBaseUrl: false,
    secretRequired: true,
  },
  {
    type: "doubao",
    labelKey: "ai.provider.doubao",
    defaultLabel: "豆包 / 火山方舟",
    defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    suggestedBaseUrls: [
      {
        value: "https://ark.cn-beijing.volces.com/api/v3",
        labelKey: "ai.baseUrl.doubao.beijing",
        defaultLabel: "北京",
      },
      {
        value: "https://ark.cn-beijing.volces.com/api/coding",
        labelKey: "ai.baseUrl.doubao.coding",
        defaultLabel: "编码套餐",
      },
      {
        value: "https://ark.ap-southeast.bytepluses.com/api/v3",
        labelKey: "ai.baseUrl.doubao.apac",
        defaultLabel: "亚太",
      },
    ],
    suggestedModels: [
      "doubao-seed-2-1-pro-260628",
      "doubao-seed-2-1-turbo-260628",
      "doubao-seed-2-0-pro-260215",
      "doubao-seed-2-0-lite-260428",
      "deepseek-v4-pro-ga-260813",
      "doubao-seed-1-6-251015",
    ],
    requiresBaseUrl: false,
    secretRequired: true,
    supportedPurposes: ["chat", "stt", "tts"],
  },
  {
    type: "openai",
    labelKey: "ai.provider.openai",
    defaultLabel: "OpenAI",
    defaultBaseUrl: "https://api.openai.com",
    suggestedModels: [
      "gpt-5.6",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
      "gpt-5.5",
      "gpt-5.4",
      "gpt-5.1",
      "gpt-5",
      "gpt-4.1",
      "gpt-4o",
      "gpt-4o-mini",
      "o3",
      "o4-mini",
    ],
    requiresBaseUrl: false,
    secretRequired: true,
    supportedPurposes: ["chat", "stt", "tts"],
  },
  {
    type: "openai-compatible",
    labelKey: "ai.provider.openaiCompatible",
    defaultLabel: "OpenAI Compatible",
    defaultBaseUrl: "",
    suggestedModels: [],
    requiresBaseUrl: true,
    secretRequired: true,
    supportedPurposes: ["chat", "stt", "tts"],
  },
  {
    type: "anthropic",
    labelKey: "ai.provider.anthropic",
    defaultLabel: "Anthropic",
    defaultBaseUrl: "https://api.anthropic.com",
    suggestedModels: [
      "claude-opus-4-5",
      "claude-sonnet-4-5",
      "claude-haiku-4-5",
      "claude-opus-4-1",
      "claude-sonnet-4-0",
      "claude-3-5-haiku-latest",
    ],
    requiresBaseUrl: false,
    secretRequired: true,
  },
  {
    type: "gemini",
    labelKey: "ai.provider.gemini",
    defaultLabel: "Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    suggestedModels: [
      "gemini-3.1-pro-preview",
      "gemini-3.6-flash",
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-2.5-pro",
    ],
    requiresBaseUrl: false,
    secretRequired: true,
    supportedPurposes: ["chat", "stt", "tts"],
  },
  {
    type: "luminary-managed",
    labelKey: "ai.provider.luminaryManaged",
    defaultLabel: "Luminary Managed",
    defaultBaseUrl: "",
    suggestedModels: ["luminary-default"],
    requiresBaseUrl: false,
    secretRequired: false,
    availabilityHintKey: "ai.managedUnavailable",
  },
];

export interface ProviderFormFields {
  displayName?: string;
  model?: string;
  baseUrl?: string;
  secret?: string;
  purpose?: string;
}

export function getProviderPreset(type: string): AiProviderPreset | undefined {
  return AI_PROVIDER_PRESETS.find((item) => item.type === type);
}

export function hasMultipleBaseUrls(preset: AiProviderPreset | undefined): boolean {
  return (preset?.suggestedBaseUrls?.length ?? 0) > 1;
}

export function fieldsForProvider(preset: AiProviderPreset): ProviderFormFields {
  return {
    displayName: preset.defaultLabel,
    model: preset.suggestedModels[0] ?? "",
    baseUrl: preset.defaultBaseUrl,
    secret: "",
    purpose: "",
  };
}

export function isProviderFormReadyForTest(
  values: (ProviderFormFields & { providerType?: string }) | undefined,
  preset: AiProviderPreset | undefined,
  hasSavedSecret: boolean,
): boolean {
  if (!values?.providerType?.trim()) return false;
  if (!values.displayName?.trim()) return false;
  if (!values.model?.trim()) return false;
  if (preset?.requiresBaseUrl && !values.baseUrl?.trim()) return false;
  const secretRequired = preset ? preset.secretRequired : !hasSavedSecret;
  if (secretRequired && !hasSavedSecret && !values.secret?.trim()) return false;
  return true;
}

export function formHasUserInput(
  current: ProviderFormFields,
  preset: AiProviderPreset | undefined,
): boolean {
  if (current.secret?.trim()) return true;
  if (current.purpose?.trim() && !purposesEqual(current.purpose, defaultPurposeFor(preset))) {
    return true;
  }
  if (!preset) {
    return Boolean(current.displayName?.trim() || current.model?.trim() || current.baseUrl?.trim());
  }
  if (current.displayName?.trim() && current.displayName !== preset.defaultLabel) return true;
  if (current.model?.trim() && current.model !== (preset.suggestedModels[0] ?? "")) return true;
  if ((current.baseUrl ?? "").trim() !== preset.defaultBaseUrl) return true;
  return false;
}

export function canRefreshProviderModels(input: {
  secret?: string;
  requiresBaseUrl?: boolean;
  baseUrl?: string;
  hasSavedSecret?: boolean;
}): boolean {
  if (!input.secret?.trim() && !input.hasSavedSecret) return false;
  if (input.requiresBaseUrl && !input.baseUrl?.trim()) return false;
  return true;
}

export function pickDefaultModel(models: string[], current?: string): string {
  const active = current?.trim();
  if (active && models.includes(active)) return active;
  return models[0] ?? active ?? "";
}

export function parsePurposes(value?: string | string[] | null): string[] {
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,|;]+/)) {
    const id = part.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function serializePurposes(values: string[]): string {
  return parsePurposes(values.join(",")).join(",");
}

export function purposesEqual(left?: string | null, right?: string | null): boolean {
  return serializePurposes(parsePurposes(left)) === serializePurposes(parsePurposes(right));
}

export function supportedPurposesOf(preset?: AiProviderPreset | null): string[] {
  if (preset?.supportedPurposes?.length) return [...preset.supportedPurposes];
  return ["chat"];
}

export function showPurposeSelect(preset?: AiProviderPreset | null): boolean {
  return supportedPurposesOf(preset).length > 1;
}

export function defaultPurposeFor(preset?: AiProviderPreset | null): string {
  const list = supportedPurposesOf(preset);
  if (list.includes("chat")) return "chat";
  return list[0] ?? "chat";
}

export function connectionHasPurpose(
  stored: string | null | undefined,
  wanted: string,
): boolean {
  const list = parsePurposes(stored);
  if (list.length === 0) return wanted === "chat";
  return list.includes(wanted);
}
