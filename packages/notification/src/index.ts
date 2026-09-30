export {
  NOTIFICATION_MODULE_OPTIONS,
  NotificationChannelNotConfiguredError,
  NotificationValidationError,
  isEmailConfigured,
  type EmailAttachment,
  type EmailChannelOptions,
  type EmailDefaults,
  type EmailMessage,
  type NotificationChannel,
  type NotificationModuleAsyncOptions,
  type NotificationModuleOptions,
  type SendEmailResult,
  type SmtpTransportOptions,
} from "./contracts";
export { NotificationModule } from "./notification.module";
export { NotificationService } from "./notification.service";
export { EmailChannel } from "./email/email.channel";
export { buildMailerOptions } from "./email/mailer-options";
export {
  buildImWebhookRequest,
  imBodyOk,
  redactImWebhookUrl,
  sendImWebhook,
  type ImChannel,
  type ImWebhookMessage,
  type ImWebhookResult,
} from "./im/im-webhook";
export {
  AuthMailDeliveryError,
  AuthMailNotConfiguredError,
  AuthMailUnknownOutcomeError,
  ProviderAttemptError,
} from "./auth-mail/errors";
export {
  QUOTA_SWITCH_RATIO,
  type AuthMailMessage,
  type AuthMailSendResult,
  type ByoMailProfile,
  type ChainProvider,
  type EmailProvider,
  type EmailProviderKind,
  type IdempotencyClaim,
  type IdempotencyRecord,
  type IdempotencyStatus,
  type IdempotencyStore,
  type MailUsage,
} from "./auth-mail/types";
export {
  PUBLIC_MAIL_DOMAINS,
  assertPrivateMatchDomains,
  isPublicMailDomain,
  recipientDomain,
} from "./auth-mail/domains";
export {
  MemoryIdempotencyStore,
  buildAuthMailIdempotencyKey,
} from "./auth-mail/idempotency";
export { quotaBlocks, resolveByoProfile, selectProviders } from "./auth-mail/resolve";
export { sendWithChain } from "./auth-mail/chain";
export { classifyHttpFailure, formatMailbox } from "./auth-mail/http";
export { createBrevoProvider } from "./auth-mail/providers/brevo";
export { createResendProvider } from "./auth-mail/providers/resend";
export { createSmtpProvider, type SmtpSendInput, type SmtpSendResult } from "./auth-mail/providers/smtp";
export { createMailgunProvider } from "./auth-mail/providers/mailgun";
