import type { MailerOptions } from "@nestjs-modules/mailer";
import {
  isEmailConfigured,
  type NotificationModuleOptions,
} from "../contracts";

/**
 * Build MailerModule options. When Email is disabled, use jsonTransport so Nest
 * can boot without a real SMTP host; EmailChannel still refuses send().
 */
export function buildMailerOptions(
  options: NotificationModuleOptions,
): MailerOptions {
  if (!isEmailConfigured(options)) {
    return {
      transport: {
        jsonTransport: true,
      },
      defaults: options.email?.defaults,
    };
  }

  const transport = options.email!.transport!;
  const port = transport.port ?? 587;
  const secure = transport.secure ?? port === 465;
  const requireTLS =
    transport.requireTLS ?? (!secure && (port === 587 || port === 25));

  // Nodemailer SMTP options include Node net.connect fields (family) not always
  // reflected in @nestjs-modules/mailer's Transport typings.
  const smtpTransport = {
    host: transport.host,
    port,
    secure,
    requireTLS,
    // Prefer IPv4: some SES Mail Manager endpoints hang on dual-stack Windows clients.
    family: 4 as const,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 60_000,
    tls: {
      minVersion: "TLSv1.2" as const,
      servername: transport.host,
    },
    auth: transport.user
      ? {
          user: transport.user,
          pass: transport.pass ?? "",
        }
      : undefined,
  };

  return {
    transport: smtpTransport as MailerOptions["transport"],
    defaults: options.email?.defaults,
  };
}
