/** Host-app translator. Callers pass already-resolved labels or `t(key)` with no inline fallback. */
export type TranslateFn = (key: string) => string;
