import { ExperienceApiError } from "./logto-experience-adapter";

export type LoginErrorContext = "send-code" | "register" | "sign-in";

export interface LoginErrorLabels {
  codeSendFailed: string;
  actionFailed: string;
}

const MAX_VISIBLE = 140;

function rawMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? "");
}

function isConnectorFailure(error: unknown, message: string): boolean {
  const code = error instanceof ExperienceApiError ? error.code : "";
  return (
    code === "connector.general" ||
    /error occurred in connector|ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT/i.test(message)
  );
}

function isUnsafeDump(message: string): boolean {
  return (
    message.length > MAX_VISIBLE ||
    message.includes("{") ||
    message.includes("[") ||
    /bearer\s+/i.test(message)
  );
}

/** One short line for the login card. Connector payloads stay off the screen. */
export function toLoginErrorLine(
  error: unknown,
  labels: LoginErrorLabels,
  context: LoginErrorContext,
): string {
  const message = rawMessage(error).trim();
  const fallback = context === "send-code" ? labels.codeSendFailed : labels.actionFailed;
  if (!message || isConnectorFailure(error, message) || isUnsafeDump(message)) return fallback;
  return message;
}
