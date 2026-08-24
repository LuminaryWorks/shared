"use client";

export type {
  AiProviderBaseUrlOption,
  AiProviderPreset,
  ProviderFormFields,
} from "@luminaryworks/ai-client/catalog";
export {
  AI_PROVIDER_PRESETS,
  canRefreshProviderModels,
  fieldsForProvider,
  formHasUserInput,
  getProviderPreset,
  hasMultipleBaseUrls,
  isProviderFormReadyForTest,
  pickDefaultModel,
  parsePurposes,
  serializePurposes,
  showPurposeSelect,
  supportedPurposesOf,
  defaultPurposeFor,
  connectionHasPurpose,
} from "@luminaryworks/ai-client/catalog";

export { ModelForm } from "./ModelForm";
export { MODEL_FORM_LABELS, resolveTranslate } from "./labels";
export type { TranslateFn } from "./labels";
export { mergeModelOptions } from "./merge-model-options";
export { useProviderModelOptions } from "./use-provider-model-options";
export type {
  ListProviderModels,
  ListProviderModelsInput,
  ListProviderModelsResult,
  ModelFormConnection,
  ModelFormProps,
  ModelFormPurposeOption,
  ModelFormSecretMode,
  ModelFormValues,
} from "./types";
