/**
 * Optional live SMTP smoke for @luminaryworks/notification.
 *
 * Usage (never commit real secrets):
 *   $env:SMTP_HOST="..."
 *   $env:SMTP_PORT="587"
 *   $env:SMTP_USER="..."
 *   $env:SMTP_PASS="..."
 *   $env:SMTP_REQUIRE_TLS="true"
 *   $env:SMOKE_FROM="report@example.com"
 *   $env:SMOKE_TO="you@example.com"
 *   node packages/notification/scripts/smtp-smoke.cjs
 *
 * If SMTP_HOST / SMOKE_TO are missing, the script exits 0 and skips.
 */
const nodemailer = require("nodemailer");

function env(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return fallback;
  }
  return value;
}

function parseBool(value, fallback) {
  if (value === undefined || value === "") {
    return fallback;
  }
  return value === "true" || value === "1";
}

async function main() {
  const host = env("SMTP_HOST");
  const to = env("SMOKE_TO");
  const from = env("SMOKE_FROM", "report@luminaryworks.dev");

  if (!host || !to) {
    console.log(
      "[smtp-smoke] skipped: set SMTP_HOST and SMOKE_TO (and credentials) to run live send.",
    );
    return;
  }

  const port = Number(env("SMTP_PORT", "587"));
  const secure = parseBool(process.env.SMTP_SECURE, port === 465);
  const requireTLS = parseBool(
    process.env.SMTP_REQUIRE_TLS,
    !secure && port === 587,
  );
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASS");

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS,
    auth: user ? { user, pass: pass ?? "" } : undefined,
  });

  const info = await transporter.sendMail({
    from,
    to,
    subject: "[LuminaryWorks] notification SMTP smoke",
    text: "SMTP smoke from @luminaryworks/notification",
    html: "<p>SMTP smoke from <code>@luminaryworks/notification</code></p>",
  });

  console.log("[smtp-smoke] accepted messageId=", info.messageId);
  console.log("[smtp-smoke] accepted=", info.accepted);
  console.log("[smtp-smoke] rejected=", info.rejected);
}

main().catch((error) => {
  console.error("[smtp-smoke] failed:", error?.message || error);
  process.exit(1);
});
