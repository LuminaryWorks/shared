import { rs } from "@rstest/core";
import type { EmailChannel } from "./email/email.channel";
import { NotificationService } from "./notification.service";

describe("NotificationService", () => {
  it("delegates email configuration and send", async () => {
    const emailChannel = {
      isConfigured: rs.fn(() => true),
      send: rs.fn(async () => ({
        messageId: "1",
        accepted: ["a@example.com"],
        rejected: [],
      })),
    } as unknown as EmailChannel;

    const service = new NotificationService(emailChannel);
    expect(service.isConfigured("email")).toBe(true);
    expect(service.isConfigured("slack")).toBe(false);

    const result = await service.sendEmail({
      from: "a@example.com",
      to: ["b@example.com"],
      subject: "s",
      text: "t",
    });
    expect(result.messageId).toBe("1");
    expect(emailChannel.send).toHaveBeenCalledTimes(1);
  });
});
