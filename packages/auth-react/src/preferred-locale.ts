/**
 * Preferred UI locale for LuminaryWorks product login and app shells.
 *
 * Order: saved preference, then browser/OS language list, then time zone
 * only when no supported language matched, then English.
 * A recognized browser language is never overridden by time zone.
 *
 * Product repos copy this file. Keep copies in sync with
 * `@luminaryworks/auth-react` `src/preferred-locale.ts`.
 */

export const PREFERRED_LOCALES = [
  "zh-CN",
  "zh-TW",
  "ja",
  "ko",
  "en",
  "pt",
  "nl",
  "it",
  "es",
  "fr",
] as const;

export type PreferredLocale = (typeof PREFERRED_LOCALES)[number];

const PREFERRED_SET = new Set<string>(PREFERRED_LOCALES);

const MAINLAND_CHINA_ZONES = new Set([
  "asia/shanghai",
  "asia/chongqing",
  "asia/chungking",
  "asia/harbin",
  "asia/urumqi",
  "asia/kashgar",
]);

const TRADITIONAL_CHINESE_ZONES = new Set([
  "asia/taipei",
  "asia/hong_kong",
  "asia/macau",
  "asia/macao",
]);

const SPANISH_ZONES = new Set([
  "europe/madrid",
  "atlantic/canary",
  "africa/ceuta",
  "america/mexico_city",
  "america/cancun",
  "america/merida",
  "america/monterrey",
  "america/tijuana",
  "america/hermosillo",
  "america/mazatlan",
  "america/chihuahua",
  "america/bahia_banderas",
  "america/bogota",
  "america/lima",
  "america/santiago",
  "america/punta_arenas",
  "america/buenos_aires",
  "america/argentina/buenos_aires",
  "america/argentina/cordoba",
  "america/argentina/mendoza",
  "america/caracas",
  "america/montevideo",
  "america/asuncion",
  "america/la_paz",
  "america/guayaquil",
  "america/panama",
  "america/costa_rica",
  "america/guatemala",
  "america/tegucigalpa",
  "america/managua",
  "america/el_salvador",
  "america/havana",
  "america/santo_domingo",
]);

const PORTUGUESE_ZONES = new Set([
  "europe/lisbon",
  "atlantic/madeira",
  "atlantic/azores",
  "america/sao_paulo",
  "america/fortaleza",
  "america/recife",
  "america/bahia",
  "america/manaus",
  "america/belem",
  "america/cuiaba",
  "america/porto_velho",
  "america/boa_vista",
  "america/rio_branco",
  "america/noronha",
  "america/araguaina",
  "america/santarem",
  "america/maceio",
]);

/** Map one BCP 47 tag onto a supported locale, or null when it is unsupported. */
export function matchSupportedLocale(tag: string | null | undefined): PreferredLocale | null {
  const raw = (tag ?? "").trim().replace(/_/g, "-").toLowerCase();
  if (!raw) return null;
  if (PREFERRED_SET.has(raw)) return raw as PreferredLocale;

  if (raw === "zh" || raw === "zh-cn" || raw === "zh-hans" || raw.startsWith("zh-hans") || raw.startsWith("zh-cn")) {
    return "zh-CN";
  }
  if (
    raw.startsWith("zh") &&
    (raw.includes("tw") || raw.includes("hk") || raw.includes("mo") || raw.includes("hant"))
  ) {
    return "zh-TW";
  }
  if (raw.startsWith("zh")) return "zh-CN";

  const primary = raw.split("-")[0];
  if (primary && PREFERRED_SET.has(primary)) return primary as PreferredLocale;
  return null;
}

/** Guess a locale from an IANA time zone. Ambiguous zones return null. */
export function localeFromTimeZone(timeZone: string | null | undefined): PreferredLocale | null {
  const zone = (timeZone ?? "").trim().toLowerCase();
  if (!zone) return null;
  if (MAINLAND_CHINA_ZONES.has(zone)) return "zh-CN";
  if (TRADITIONAL_CHINESE_ZONES.has(zone)) return "zh-TW";
  if (zone === "asia/tokyo") return "ja";
  if (zone === "asia/seoul") return "ko";
  if (zone === "europe/paris") return "fr";
  if (zone === "europe/rome") return "it";
  if (zone === "europe/amsterdam") return "nl";
  if (SPANISH_ZONES.has(zone)) return "es";
  if (PORTUGUESE_ZONES.has(zone)) return "pt";
  return null;
}

export interface PreferredLocaleInput {
  /** Saved user choice, or an explicit URL/cookie override. Invalid values are ignored. */
  stored?: string | null;
  /** `navigator.languages` or an `Accept-Language` list, most preferred first. */
  languages?: readonly string[] | null;
  /** IANA zone. Used only when no supported language matched. */
  timeZone?: string | null;
}

export function resolvePreferredLocale(input: PreferredLocaleInput = {}): PreferredLocale {
  const stored = matchSupportedLocale(input.stored);
  if (stored) return stored;
  for (const language of input.languages ?? []) {
    const match = matchSupportedLocale(language);
    if (match) return match;
  }
  return localeFromTimeZone(input.timeZone) ?? "en";
}

/** Browser signals. Empty during SSR so the server does not use its own time zone. */
export function readClientLocaleSignals(): { languages: string[]; timeZone?: string } {
  if (typeof navigator === "undefined") return { languages: [] };
  const languages: string[] = [];
  const seen = new Set<string>();
  const list = [...(navigator.languages ?? []), navigator.language];
  for (const tag of list) {
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    languages.push(tag);
  }
  let timeZone: string | undefined;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    timeZone = undefined;
  }
  return { languages, timeZone };
}

/** Saved value, then browser language, then time zone, then English. */
export function detectClientPreferredLocale(stored?: string | null): PreferredLocale {
  const signals = readClientLocaleSignals();
  return resolvePreferredLocale({
    stored,
    languages: signals.languages,
    timeZone: signals.timeZone,
  });
}
