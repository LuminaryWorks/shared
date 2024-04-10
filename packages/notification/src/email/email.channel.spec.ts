import { MailerService } from "@nestjs-modules/mailer";
import { rs } from "@rstest/core";
import {
  NotificationChannelNotConfiguredError,
  NotificationValidationError,
  type NotificationModuleOptions,
} from "../contracts";
import { EmailChannel } from "./email.channel";

describe("EmailChannel", () => {
  const configured: NotificationModuleOptions = {
    email: {
      transport: {
        host: "smtp.example.com",
        port: 587,
        user: "user",
        pass: "pass",
      },
    },
  };

  function createChannel(
    options: NotificationModuleOptions,
    sendMail: ReturnType<typeof rs.fn>,
  ) {
    const mailer = { sendMail } as unknown as MailerService;
    return new EmailChannel(options, mailer);
  }

  it("isConfigured is false without host", () => {
    const channel = createChannel({}, rs.fn());
    expect(channel.isConfigured()).toBe(false);
  });

  it("throws when sending without configuration", async () => {
    const channel = createChannel({}, rs.fn());
    await expect(
      channel.send({
        from: "noreply@example.com",
        to: ["a@example.com"],
        subject: "hi",
        text: "body",
      }),
    ).rejects.toBeInstanceOf(NotificationChannelNotConfiguredError);
  });

  it("maps fields, CID attachments, and returns result", async () => {
    const sendMail = rs.fn(async () => ({
      messageId: "<id@localhost>",
      accepted: ["a@example.com"],
      rejected: [],
    }));
    const channel = createChannel(configured, sendMail);

    const result = await channel.send({
      from: "report@example.com",
      fromName: 'Acme "Reports"',
      to: ["a@example.com"],
      cc: ["cc@example.com"],
      subject: "Dashboard",
      html: "<p>hi</p>",
      attachments: [
        {
          filename: "dashboard.png",
          content: Buffer.from("png"),
          cid: "dashboard-screenshot",
          contentType: "image/png",
        },
      ],
    });

    expect(result).toEqual({
      messageId: "<id@localhost>",
      accepted: ["a@example.com"],
      rejected: [],
    });
    expect(sendMail).toHaveBeenCalledTimes(1);
    const arg = sendMail.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.from).toBe('"Acme \\"Reports\\"" <report@example.com>');
    expect(arg.to).toEqual(["a@example.com"]);
    expect(arg.cc).toEqual(["cc@example.com"]);
    expect(arg.subject).toBe("Dashboard");
    expect(arg.html).toBe("<p>hi</p>");
    expect(arg.attachments).toEqual([
      {
        filename: "dashboard.png",
        content: Buffer.from("png"),
        contentType: "image/png",
        cid: "dashboard-screenshot",
      },
    ]);
  });

  it("propagates mailer errors", async () => {
    const sendMail = rs.fn(async () => {
      throw new Error("smtp down");
    });
    const channel = createChannel(configured, sendMail);
    await expect(
      channel.send({
        from: "report@example.com",
        to: ["a@example.com"],
        subject: "Dashboard",
        text: "hi",
      }),
    ).rejects.toThrow("smtp down");
  });

  it("returns partial accept instead of throwing when some recipients rejected", async () => {
    const sendMail = rs.fn(async () => ({
      messageId: "<id@localhost>",
      accepted: ["ok@example.com"],
      rejected: ["bad@example.com"],
      response: "250 OK",
    }));
    const channel = createChannel(configured, sendMail);
    const result = await channel.send({
      from: "report@example.com",
      to: ["ok@example.com", "bad@example.com"],
      subject: "Dashboard",
      text: "hi",
    });
    expect(result.accepted).toEqual(["ok@example.com"]);
    expect(result.rejected).toEqual(["bad@example.com"]);
  });

  it("throws when SMTP accepts nobody", async () => {
    const sendMail = rs.fn(async () => ({
      messageId: "<id@localhost>",
      accepted: [],
      rejected: ["bad@example.com"],
      response: "550",
    }));
    const channel = createChannel(configured, sendMail);
    await expect(
      channel.send({
        from: "report@example.com",
        to: ["bad@example.com"],
        subject: "Dashboard",
        text: "hi",
      }),
    ).rejects.toThrow(/SMTP accepted no recipients/);
  });
});
