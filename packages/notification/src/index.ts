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
