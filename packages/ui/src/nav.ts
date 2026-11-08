import type { TranslateFn } from "./translate";

export type NavItemConfig = {
  key: string;
  to: string;
  labelKey?: string;
  label?: string;
  /** `false` hides the item. Omit or `true` to show it. */
  visible?: boolean;
};

export type NavGroupConfig = {
  key: string;
  labelKey?: string;
  label?: string;
  visible?: boolean;
  items: NavItemConfig[];
};

export function navLabel(
  t: TranslateFn | undefined,
  label: string | undefined,
  labelKey: string | undefined,
): string {
  if (label !== undefined) return label;
  if (labelKey && t) return t(labelKey);
  return labelKey ?? "";
}

export function filterNav<T extends NavItemConfig>(
  groups: Array<Omit<NavGroupConfig, "items"> & { items: T[] }>,
): Array<Omit<NavGroupConfig, "items"> & { items: T[] }> {
  return groups
    .filter((group) => group.visible !== false)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.visible !== false),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * Picks the menu key for `pathname`.
 * `/` matches only the index. Other items match themselves or a child path.
 * The longest `to` wins so `/commerce/channels` beats `/commerce`.
 * When nothing matches, the index item's key is used, or `"/"`.
 */
export function resolveSelectedNavKey(
  items: Array<Pick<NavItemConfig, "key" | "to">>,
  pathname: string,
): string {
  const ranked = [...items].sort((a, b) => b.to.length - a.to.length);
  const match = ranked.find((item) =>
    item.to === "/"
      ? pathname === "/"
      : pathname === item.to || pathname.startsWith(`${item.to}/`),
  );
  if (match) return match.key;
  return items.find((item) => item.to === "/")?.key ?? "/";
}
