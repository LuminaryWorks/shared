import { isPublicMailDomain, recipientDomain } from "./domains";
import type { ByoMailProfile, ChainProvider, MailUsage } from "./types";
import { QUOTA_SWITCH_RATIO } from "./types";

function byPriority(a: ByoMailProfile, b: ByoMailProfile): number {
  return a.priority - b.priority || a.id.localeCompare(b.id);
}

/**
 * Pick an enterprise or private-deployment sender.
 * Platform-scope rows are not selected here; they belong on the platform chain.
 * Returns null when the platform chain should send.
 */
export function resolveByoProfile(input: {
  organizationId?: string | null;
  recipient: string;
  profiles: ByoMailProfile[];
}): ByoMailProfile | null {
  const usable = input.profiles.filter(
    (profile) => profile.enabled && profile.verified && profile.scope !== "platform",
  );
  const orgId = input.organizationId?.trim();
  if (orgId) {
    const orgHit = usable
      .filter((profile) => profile.scope === "organization" && profile.organizationId === orgId)
      .sort(byPriority)[0];
    if (orgHit) return orgHit;
  }

  const domain = recipientDomain(input.recipient);
  if (domain && !isPublicMailDomain(domain)) {
    const domainHit = usable
      .filter((profile) =>
        profile.matchDomains.some((item) => item.trim().toLowerCase() === domain),
      )
      .sort(byPriority)[0];
    if (domainHit) return domainHit;
  }

  return usable.filter((profile) => profile.scope === "deployment").sort(byPriority)[0] ?? null;
}

export function quotaBlocks(provider: ChainProvider): boolean {
  if (provider.dailyQuota > 0 && provider.sentToday >= provider.dailyQuota * QUOTA_SWITCH_RATIO) {
    return true;
  }
  if (
    provider.monthlyQuota > 0 &&
    provider.sentThisMonth >= provider.monthlyQuota * QUOTA_SWITCH_RATIO
  ) {
    return true;
  }
  return false;
}

export function selectProviders(providers: ChainProvider[], usage: MailUsage): ChainProvider[] {
  return providers
    .filter((provider) => provider.enabled && provider.usage === usage && !quotaBlocks(provider))
    .sort(
      (a, b) => a.priority - b.priority || a.provider.id.localeCompare(b.provider.id),
    );
}
