import { buildMailerOptions } from "./mailer-options";

describe("buildMailerOptions", () => {
  it("uses jsonTransport when email is not configured", () => {
    const options = buildMailerOptions({});
    expect(options.transport).toEqual({ jsonTransport: true });
  });

  it("defaults port 587 to STARTTLS (secure=false, requireTLS=true)", () => {
    const options = buildMailerOptions({
      email: {
        transport: {
          host: "smtp.example.com",
          port: 587,
          user: "smtp-user",
          pass: "smtp-pass",
        },
      },
    });
    expect(options.transport).toMatchObject({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      requireTLS: true,
      family: 4,
      auth: { user: "smtp-user", pass: "smtp-pass" },
    });
  });

  it("defaults port 465 to implicit TLS", () => {
    const options = buildMailerOptions({
      email: {
        transport: {
          host: "smtp.example.com",
          port: 465,
        },
      },
    });
    expect(options.transport).toMatchObject({
      port: 465,
      secure: true,
      requireTLS: false,
    });
  });
});
