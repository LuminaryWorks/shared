import { MailerService } from "@nestjs-modules/mailer";
import { Inject, Injectable } from "@nestjs/common";
import {
  isEmailConfigured,
  NOTIFICATION_MODULE_OPTIONS,
  NotificationChannelNotConfiguredError,
  NotificationValidationError,
  type EmailMessage,
  type NotificationModuleOptions,
  type SendEmailResult,
} from "../contracts";

@Injectable()
export class EmailChannel {
  constructor(
    @Inject(NOTIFICATION_MODULE_OPTIONS)
    private readonly options: NotificationModuleOptions,
    private readonly mailer: MailerService,
  ) {}

  isConfigured(): boolean {
    return isEmailConfigured(this.options);
  }

  async send(message: EmailMessage): Promise<SendEmailResult> {
    if (!this.isConfigured()) {
      throw new NotificationChannelNotConfiguredError("email");
    }
    this.validate(message);

    const from = message.fromName
      ? `"${escapeFromDisplayName(message.fromName)}" <${message.from}>`
      : message.from;

    const info = await this.mailer.sendMail({
      from,
      // Keep envelope From as the bare address (verified identity for SES / Mail Manager).
      envelope: {
        from: message.from,
        to: message.to,
      },
      to: message.to,
      cc: message.cc,
      bcc: message.bcc,
      replyTo: message.replyTo,
      subject: message.subject,
      html: message.html,
      text: message.text,
      attachments: message.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
        cid: attachment.cid,
      })),
    });

    const result: SendEmailResult = {
      messageId: typeof info.messageId === "string" ? info.messageId : undefined,
      accepted: normalizeAddressList(info.accepted),
      rejected: normalizeAddressList(info.rejected),
    };

    // Partial rejects are expected (one bad address in a batch). Callers decide
    // whether that is a hard failure; only "nobody accepted" is fatal here.
    if (result.accepted.length === 0) {
      throw new Error(
        `SMTP accepted no recipients: rejected=[${result.rejected.join(",")}] ` +
          `messageId=${result.messageId ?? "-"} ` +
          `response=${typeof info.response === "string" ? info.response : "-"}`,
      );
    }

    return result;
  }

  private validate(message: EmailMessage): void {
    if (!message.from?.trim()) {
      throw new NotificationValidationError("EmailMessage.from is required");
    }
    if (!Array.isArray(message.to) || message.to.length === 0) {
      throw new NotificationValidationError(
        "EmailMessage.to must contain at least one recipient",
      );
    }
    if (!message.subject?.trim()) {
      throw new NotificationValidationError("EmailMessage.subject is required");
    }
    if (!message.html?.trim() && !message.text?.trim()) {
      throw new NotificationValidationError(
        "EmailMessage requires html or text body",
      );
    }
  }
}

function escapeFromDisplayName(name: string): string {
  return name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function normalizeAddressList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}
