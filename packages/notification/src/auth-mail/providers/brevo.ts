import { postJson } from "../http";
import type { AuthMailMessage, EmailProvider } from "../types";

export function createBrevoProvider(options: {
  id?: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
  endpoint?: string;
}): EmailProvider {
  return {
    id: options.id ?? "brevo",
    kind: "brevo",
    async send(message: AuthMailMessage) {
      const json = await postJson({
        url: options.endpoint ?? "https://api.brevo.com/v3/smtp/email",
        headers: { "api-key": options.apiKey },
        fetchImpl: options.fetchImpl,
        body: {
          sender: {
            email: message.from,
            name: message.fromName?.trim() || undefined,
          },
          to: [{ email: message.to }],
          subject: message.subject,
          htmlContent: message.html,
          textContent: message.text,
        },
      });
      const messageId =
        json && typeof json === "object" && "messageId" in json
          ? String((json as { messageId?: unknown }).messageId ?? "")
          : "";
      return { providerMessageId: messageId || "accepted" };
    },
  };
}
