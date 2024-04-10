import { Injectable } from "@nestjs/common";
import type {
  EmailMessage,
  NotificationChannel,
  SendEmailResult,
} from "./contracts";
import { EmailChannel } from "./email/email.channel";

@Injectable()
export class NotificationService {
  constructor(private readonly emailChannel: EmailChannel) {}

  isConfigured(channel: NotificationChannel = "email"): boolean {
    if (channel === "email") {
      return this.emailChannel.isConfigured();
    }
    // Future channels: slack / teams / webhook / sms
    return false;
  }

  sendEmail(message: EmailMessage): Promise<SendEmailResult> {
    return this.emailChannel.send(message);
  }
}
