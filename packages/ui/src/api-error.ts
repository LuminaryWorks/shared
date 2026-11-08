export type ApiErrorView = {
  status: number;
  code: string;
  message: string;
};

const ERROR_MESSAGE_KEYS = {
  generic: "generic",
  unauthorized: "unauthorized",
  paymentRequired: "paymentRequired",
  forbidden: "forbidden",
} as const;

export type ErrorMessageKey = keyof typeof ERROR_MESSAGE_KEYS;

export function readApiError(error: unknown): ApiErrorView | null {
  if (!error || typeof error !== "object" || Array.isArray(error)) return null;
  const value = error as { status?: unknown; code?: unknown; message?: unknown };
  if (typeof value.status !== "number" || typeof value.code !== "string") return null;
  const message =
    error instanceof Error
      ? error.message
      : typeof value.message === "string"
        ? value.message
        : "";
  return { status: value.status, code: value.code, message };
}

export function errorMessageKey(status: number | undefined): ErrorMessageKey {
  if (status === 401) return "unauthorized";
  if (status === 402) return "paymentRequired";
  if (status === 403) return "forbidden";
  return "generic";
}
