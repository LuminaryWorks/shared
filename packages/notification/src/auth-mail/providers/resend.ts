import type { AuthMailMessage, EmailProvider } from "../types";
import { formatMailbox, postJson } from "../http";

export function createResendProvider(options: {
  id?: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
  endpoint?: string;
}): EmailProvider {
  return {
    id: options.id ?? "resend",
    kind: "resend",
    async send(message: AuthMailMessage) {
      const json = await postJson({
        url: options.endpoint ?? "https://api.resend.com/emails",
        headers: { authorization: `Bearer ${options.apiKey}` },
        fetchImpl: options.fetchImpl,
        body: {
          from: formatMailbox(message.from, message.fromName),
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        },
      });
      const id =
        json && typeof json === "object" && "id" in json
          ? String((json as { id?: unknown }).id ?? "")
          : "";
      return { providerMessageId: id || "accepted" };
    },
  };
}
