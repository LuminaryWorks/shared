export const MODEL_FORM_LABELS: Record<string, string> = {
  "ai.provider": "提供商",
  "ai.displayName": "显示名",
  "ai.secret": "API Key",
  "ai.baseUrl": "接口地址",
  "ai.baseUrlRequired": "OpenAI Compatible 必须填写 Base URL",
  "ai.baseUrlListHint": "可从列表选择地域或套餐地址，也可填写自定义地址。",
  "ai.baseUrlPlaceholder": "选择接口地址",
  "ai.baseUrlListEmpty": "没有匹配的接口地址",
  "ai.enabled": "启用",
  "ai.default": "设为默认",
  "ai.purpose": "用途",
  "ai.purposeHint": "例如：问数、配图、文档索引",
  "ai.purposeMultiHint": "同一条连接可同时用于对话、转写和语音合成。",
  "ai.purposePlaceholder": "选择用途",
  "ai.completeForm": "请完善表单",
  "ai.vaultMissing": "服务端未配置 AI_VAULT_MASTER_KEY，无法保存密钥。",
  "ai.managedUnavailable": "服务端未配置 LUMINARY_AI_BASE_URL，托管模型暂不可用。仍可保存，但调用会失败。",
  "ai.fingerprint": "已保存密钥指纹",
  "ai.switchProviderConfirmTitle": "切换提供商？",
  "ai.switchProviderConfirm": "切换提供商会清空尚未保存的显示名、模型、接口地址和密钥。",
  "ai.providerLocked": "已保存的模型不能切换提供商，请新建一条配置。",
  "ai.secretLocked": "密钥已保存，不可查看或修改。如需更换请新建配置。",
  "ai.secretRotateHint": "留空则保留已保存密钥；填写新密钥即轮换。",
  "ai.modelListHint": "已选中该提供商的默认模型。填写密钥并失焦后会同步官方列表。",
  "ai.modelListLive": "已同步该账号可用的官方模型，默认选中第一项。",
  "ai.modelListLoading": "正在获取该提供商的模型列表…",
  "ai.modelListEmpty": "没有可用的模型，请填写密钥后刷新。",
  "ai.modelRefreshNeedSecret": "请先填写密钥",
  "ai.modelRefreshNeedBaseUrl": "请先填写接口地址",
  "ai.defaultModel": "默认模型",
  "ai.modelRefreshHint": "同步官方模型列表",
  "ai.defaultModelPlaceholder": "选择默认模型",
};

export type TranslateFn = (key: string, options?: { defaultValue?: string }) => string;

export function resolveTranslate(t?: TranslateFn): TranslateFn {
  return (key, options) => {
    const fallback = options?.defaultValue ?? MODEL_FORM_LABELS[key] ?? key;
    if (!t) return fallback;
    return t(key, { defaultValue: fallback });
  };
}
