import {
  type EntitlementErrorBody,
  type EntitlementErrorCode,
  ERROR_HTTP_STATUS,
} from "./types";

export class EntitlementClientError extends Error {
  readonly code: EntitlementErrorCode;
  readonly httpStatus: number;
  readonly productCode?: string;
  readonly featureCode?: string;
  readonly details?: Record<string, unknown>;
  readonly body?: EntitlementErrorBody;

  constructor(
    code: EntitlementErrorCode,
    message: string,
    opts?: {
      productCode?: string;
      featureCode?: string;
      details?: Record<string, unknown>;
      body?: EntitlementErrorBody;
    },
  ) {
    super(message);
    this.name = "EntitlementClientError";
    this.code = code;
    this.httpStatus = ERROR_HTTP_STATUS[code];
    this.productCode = opts?.productCode;
    this.featureCode = opts?.featureCode;
    this.details = opts?.details;
    this.body = opts?.body;
  }

  toJSON(): EntitlementErrorBody {
    return (
      this.body ?? {
        error: {
          code: this.code,
          message: this.message,
          productCode: this.productCode,
          featureCode: this.featureCode,
          httpStatus: this.httpStatus,
          details: this.details,
        },
      }
    );
  }
}

export function isEntitlementErrorBody(value: unknown): value is EntitlementErrorBody {
  if (!value || typeof value !== "object") return false;
  const err = (value as { error?: unknown }).error;
  if (!err || typeof err !== "object") return false;
  return typeof (err as { code?: unknown }).code === "string";
}

export function parseEntitlementError(payload: unknown, fallbackStatus = 503): EntitlementClientError {
  if (isEntitlementErrorBody(payload)) {
    const code = payload.error.code as EntitlementErrorCode;
    return new EntitlementClientError(code, payload.error.message, {
      productCode: payload.error.productCode,
      featureCode: payload.error.featureCode,
      details: payload.error.details,
      body: payload,
    });
  }
  return new EntitlementClientError(
    fallbackStatus >= 500 ? "ENTITLEMENT_SERVICE_UNAVAILABLE" : "VALIDATION_ERROR",
    "Entitlement request failed",
    { details: { payload } },
  );
}
