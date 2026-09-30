import { classifyHttpFailure, formatMailbox } from "../http";
import { ProviderAttemptError } from "../errors";
import type { AuthMailMessage, EmailProvider } from "../types";

/**
 * Mailgun Messages API. `domain` is MAILGUN_DOMAIN (or a profile's domain).
 * It must be the verified domain that owns `message.from`, not the sandbox host.
 */
export function createMailgunProvider(options: {
  id?: string;
  apiKey: string;
  domain: string;
  fetchImpl?: typeof fetch;
  /** Override the API origin. Default is the US endpoint. */
  endpoint?: string;
  /** When true, Mailgun validates and queues nothing. Tests only. */
  testMode?: boolean;
}): EmailProvider {
  const domain = options.domain.trim().toLowerCase();
  const origin = (options.endpoint ?? "https://api.mailgun.net").replace(/\/$/, "");
  return {
    id: options.id ?? "mailgun",
    kind: "mailgun",
    async send(message: AuthMailMessage) {
      const body = new URLSearchParams();
      body.set("from", formatMailbox(message.from, message.fromName));
      body.set("to", message.to);
      body.set("subject", message.subject);
      if (message.text) body.set("text", message.text);
      if (message.html) body.set("html", message.html);
      if (options.testMode) body.set("o:testmode", "yes");

      const fetchImpl = options.fetchImpl ?? fetch;
      let response: Response;
      try {
        response = await fetchImpl(`${origin}/v3/${domain}/messages`, {
          method: "POST",
          headers: {
            authorization: `Basic ${Buffer.from(`api:${options.apiKey}`).toString("base64")}`,
            accept: "application/json",
            "content-type": "application/x-www-form-urlencoded",
          },
          body,
          signal: AbortSignal.timeout(15_000),
        });
      } catch (err) {
        throw new ProviderAttemptError(
          err instanceof Error ? err.message : "mailgun request failed",
          { unknownOutcome: true },
        );
      }
      const text = await response.text();
      if (!response.ok) throw classifyHttpFailure(response.status, text);
      let id = "";
      try {
        const json = text ? (JSON.parse(text) as { id?: unknown }) : null;
        if (json && typeof json.id === "string") id = json.id;
      } catch {
        id = "";
      }
      return { providerMessageId: id || "accepted" };
    },
  };
}
