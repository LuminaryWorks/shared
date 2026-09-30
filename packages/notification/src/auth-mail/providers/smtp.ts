import nodemailer from "nodemailer";
import { ProviderAttemptError } from "../errors";
import { formatMailbox } from "../http";
import type { AuthMailMessage, EmailProvider } from "../types";

export interface SmtpSendInput {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  envelope: { from: string; to: string };
}

export interface SmtpSendResult {
  messageId?: string;
}

const UNKNOWN_CODES = new Set([
  "ETIMEDOUT",
  "ECONNECTION",
  "ESOCKET",
  "ECONNRESET",
  "EDNS",
  "ECONNREFUSED",
]);

export function createSmtpProvider(options: {
  id?: string;
  host: string;
  port?: number;
  user?: string;
  pass?: string;
  secure?: boolean;
  requireTLS?: boolean;
  sendMail?: (mail: SmtpSendInput) => Promise<SmtpSendResult>;
}): EmailProvider {
  const port = options.port ?? 587;
  const secure = options.secure ?? port === 465;
  const requireTLS = options.requireTLS ?? (!secure && port === 587);
  const sendMail =
    options.sendMail ??
    (async (mail: SmtpSendInput) => {
      const transport = nodemailer.createTransport({
        host: options.host,
        port,
        secure,
        requireTLS,
        auth: options.user ? { user: options.user, pass: options.pass ?? "" } : undefined,
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 20_000,
      });
      try {
        const info = await transport.sendMail(mail);
        return { messageId: typeof info.messageId === "string" ? info.messageId : undefined };
      } finally {
        transport.close();
      }
    });

  return {
    id: options.id ?? "smtp",
    kind: "smtp",
    async send(message: AuthMailMessage) {
      try {
        const info = await sendMail({
          from: formatMailbox(message.from, message.fromName),
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          envelope: { from: message.from, to: message.to },
        });
        return { providerMessageId: info.messageId || "accepted" };
      } catch (err) {
        if (err instanceof ProviderAttemptError) throw err;
        const code =
          typeof err === "object" && err && "code" in err
            ? String((err as { code?: unknown }).code ?? "")
            : "";
        const messageText = err instanceof Error ? err.message : "smtp send failed";
        if (UNKNOWN_CODES.has(code)) {
          throw new ProviderAttemptError(messageText, { unknownOutcome: true });
        }
        if (code === "EAUTH" || code === "EENVELOPE") {
          throw new ProviderAttemptError(messageText, { retryable: false });
        }
        throw new ProviderAttemptError(messageText, { unknownOutcome: true });
      }
    },
  };
}
