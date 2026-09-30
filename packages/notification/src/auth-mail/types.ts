export type MailUsage = "auth" | "product";

export type EmailProviderKind = "brevo" | "resend" | "smtp" | "mailgun";

export type IdempotencyStatus = "pending" | "sent" | "unknown" | "failed";

export interface AuthMailMessage {
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  usage: MailUsage;
  idempotencyKey: string;
}

export interface EmailProvider {
  readonly id: string;
  readonly kind: EmailProviderKind;
  send(message: AuthMailMessage): Promise<{ providerMessageId: string }>;
}

export interface ChainProvider {
  provider: EmailProvider;
  usage: MailUsage;
  enabled: boolean;
  /** Lower runs first. */
  priority: number;
  /** 0 means unlimited. */
  dailyQuota: number;
  /** 0 means unlimited. */
  monthlyQuota: number;
  sentToday: number;
  sentThisMonth: number;
}

export interface IdempotencyRecord {
  key: string;
  status: IdempotencyStatus;
  providerId?: string;
  providerMessageId?: string;
}

export interface IdempotencyClaim {
  record: IdempotencyRecord;
  /** True only when this caller inserted or reclaimed the row. */
  owned: boolean;
}

export interface IdempotencyStore {
  claim(key: string): Promise<IdempotencyClaim>;
  /** failed → pending. owned is false when the row is no longer failed. */
  reclaimFailed(key: string): Promise<IdempotencyClaim>;
  save(record: IdempotencyRecord): Promise<void>;
}

export interface AuthMailSendResult {
  providerId: string;
  providerMessageId: string;
  idempotentReplay: boolean;
}

export interface ByoMailProfile {
  id: string;
  scope: "platform" | "organization" | "deployment";
  organizationId?: string | null;
  from: string;
  fromName?: string | null;
  matchDomains: string[];
  verified: boolean;
  enabled: boolean;
  priority: number;
}

/** New auth mail switches to the next provider at this fraction of quota. */
export const QUOTA_SWITCH_RATIO = 0.95;
