"use client";

import { Alert } from "antd";
import { errorMessageKey, readApiError } from "./api-error";
import type { TranslateFn } from "./translate";

/** Locale keys the host app must define. Override with `keys` when a product uses another namespace. */
export const ERROR_BANNER_KEYS = {
  generic: "errors.generic",
  unauthorized: "errors.unauthorized",
  paymentRequired: "errors.paymentRequired",
  forbidden: "errors.forbidden",
  code: "errors.code",
} as const;

export function ErrorBanner({
  error,
  t,
  keys,
}: {
  error: unknown;
  t: TranslateFn;
  keys?: Partial<typeof ERROR_BANNER_KEYS>;
}) {
  if (!error) return null;
  const names = { ...ERROR_BANNER_KEYS, ...keys };
  const api = readApiError(error);
  const messageKey = names[errorMessageKey(api?.status)];
  const detail = api
    ? `${t(names.code)}: ${api.code} (${api.status})`
    : error instanceof Error
      ? error.message
      : String(error);
  return (
    <Alert
      type="error"
      showIcon
      style={{ marginBottom: 16 }}
      message={t(messageKey)}
      description={detail}
    />
  );
}
