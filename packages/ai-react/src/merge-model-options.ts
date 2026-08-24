export function mergeModelOptions(models: string[], currentModel?: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const current = currentModel?.trim();
  if (current) {
    seen.add(current);
    out.push(current);
  }
  for (const id of models) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
