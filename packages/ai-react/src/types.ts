import type { FormInstance } from "antd";
import type { ReactNode } from "react";
import type { TranslateFn } from "./labels";

export type ModelFormSecretMode = "locked" | "rotate";

export interface ModelFormValues {
  providerType: string;
  displayName: string;
  baseUrl?: string;
  model: string;
  secret?: string;
  enabled?: boolean;
  isDefault?: boolean;
  purpose?: string;
}

export interface ModelFormConnection {
  uid: string;
  providerType: string;
  displayName: string;
  baseUrl?: string | null;
  model: string;
  secretFingerprint?: string | null;
  enabled?: boolean;
  isDefault?: boolean;
  purpose?: string | null;
}

export interface ListProviderModelsInput {
  providerType: string;
  baseUrl?: string;
  secret?: string;
  connectionUid?: string;
}

export interface ListProviderModelsResult {
  source: "live" | "catalog";
  models: string[];
}

export type ListProviderModels = (
  input: ListProviderModelsInput,
) => Promise<ListProviderModelsResult>;

export interface ModelFormPurposeOption {
  value: string;
  label: string;
}

export interface ModelFormProps {
  form: FormInstance;
  isCreate: boolean;
  current: ModelFormConnection | null;
  vaultReady: boolean;
  /** Injected BFF call. The form never talks to the vendor. */
  listModels: ListProviderModels;
  managedReady?: boolean;
  /**
   * `locked`: edit cannot change the key (DataLuminary Space settings).
   * `rotate`: empty keeps the stored key; a new value overwrites it.
   */
  secretMode?: ModelFormSecretMode;
  t?: TranslateFn;
  purposeExtra?: ReactNode;
  purposePlaceholder?: string;
  purposeOptions?: ModelFormPurposeOption[];
  hidePurpose?: boolean;
  /** Merged after catalog defaults when the user switches provider. */
  providerSwitchPatch?: Partial<ModelFormValues>;
  children?: ReactNode;
}
