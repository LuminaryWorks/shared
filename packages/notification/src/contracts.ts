export type NotificationChannel =
  | "email"
  | "slack"
  | "teams"
  | "webhook"
  | "sms";

export interface SmtpTransportOptions {
  host: string;
  port?: number;
  /** Implicit TLS (typical for port 465). Default: true when port === 465. */
  secure?: boolean;
  /** STARTTLS required (typical for port 587 / SES Mail Manager). */
  requireTLS?: boolean;
  user?: string;
  pass?: string;
}

export interface EmailDefaults {
  from?: string;
}

export interface EmailChannelOptions {
  /** When false, Email is treated as disabled even if transport.host is set. */
  enabled?: boolean;
  transport?: SmtpTransportOptions;
  defaults?: EmailDefaults;
}

/**
 * Host-injected options. The package never reads process.env directly.
 */
export interface NotificationModuleOptions {
  email?: EmailChannelOptions;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  cid?: string;
}

export interface EmailMessage {
  from: string;
  fromName?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  messageId?: string;
  accepted: string[];
  rejected: string[];
}

export class NotificationChannelNotConfiguredError extends Error {
  readonly channel: NotificationChannel;

  constructor(channel: NotificationChannel) {
    super(`Notification channel "${channel}" is not configured`);
    this.name = "NotificationChannelNotConfiguredError";
    this.channel = channel;
  }
}

export class NotificationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotificationValidationError";
  }
}

export const NOTIFICATION_MODULE_OPTIONS = Symbol(
  "NOTIFICATION_MODULE_OPTIONS",
);

export interface NotificationModuleAsyncOptions {
  /** Nest-style async registration; host provides inject tokens. */
  imports?: any[];
  inject?: any[];
  useFactory: (
    ...args: any[]
  ) => NotificationModuleOptions | Promise<NotificationModuleOptions>;
}

export function isEmailConfigured(
  options: NotificationModuleOptions | undefined,
): boolean {
  if (!options?.email || options.email.enabled === false) {
    return false;
  }
  return Boolean(options.email.transport?.host?.trim());
}
