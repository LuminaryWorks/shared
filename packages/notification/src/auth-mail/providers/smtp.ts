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

const UNKNOWN_CODES = new Set(["ETIMEDOUT", "ECONNECTION", "ESOCKET", "ECONNRESET"]);

/** The session never accepted the message, so the next provider can send it. */
const REJECTED_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EDNS",
  "EAUTH",
  "EENVELOPE",
  "EMESSAGE",
]);

export function createSmtpProvider(options: {
  id?: string;
  host: string;
  port?: number;
  user?: string;
  pass?: string;
  secure?: boolean;
  requireTLS?: boolean;
  rejectUnauthorized?: boolean;
  /** TLS SNI. Use the mail hostname when SMTP_HOST is an IP. */
  tlsServername?: string;
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
        tls: {
          minVersion: "TLSv1.2",
          servername: options.tlsServername || options.host,
          rejectUnauthorized: options.rejectUnauthorized ?? true,
        },
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
        const responseCode =
          typeof err === "object" && err && "responseCode" in err
            ? Number((err as { responseCode?: unknown }).responseCode)
            : Number.NaN;
        if (
          REJECTED_CODES.has(code) ||
          (Number.isInteger(responseCode) && responseCode >= 400)
        ) {
          throw new ProviderAttemptError(messageText, { retryable: true });
        }
        if (UNKNOWN_CODES.has(code)) {
          throw new ProviderAttemptError(messageText, { unknownOutcome: true });
        }
        throw new ProviderAttemptError(messageText, { unknownOutcome: true });
      }
    },
  };
}
