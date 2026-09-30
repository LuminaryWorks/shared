import { NotificationValidationError } from "../contracts";

/** Consumer inboxes an enterprise must not claim as its own sending domain. */
export const PUBLIC_MAIL_DOMAINS: readonly string[] = [
  "gmail.com",
  "googlemail.com",
  "qq.com",
  "foxmail.com",
  "163.com",
  "126.com",
  "yeah.net",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "yahoo.com",
  "yahoo.co.jp",
  "proton.me",
  "protonmail.com",
  "sina.com",
  "sina.cn",
  "aliyun.com",
  "139.com",
  "aol.com",
  "gmx.com",
  "mail.com",
];

const PUBLIC = new Set(PUBLIC_MAIL_DOMAINS);

export function recipientDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

export function isPublicMailDomain(domain: string): boolean {
  return PUBLIC.has(domain.trim().toLowerCase());
}

export function assertPrivateMatchDomains(domains: string[]): string[] {
  const normalized: string[] = [];
  for (const raw of domains) {
    const domain = raw.trim().toLowerCase();
    if (!domain || domain.includes("@") || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
      throw new NotificationValidationError(`match domain is not a hostname: ${raw}`);
    }
    if (isPublicMailDomain(domain)) {
      throw new NotificationValidationError(
        `match domain ${domain} is a public mailbox and cannot route enterprise mail`,
      );
    }
    if (!normalized.includes(domain)) normalized.push(domain);
  }
  return normalized;
}
