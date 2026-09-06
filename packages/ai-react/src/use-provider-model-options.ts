import { suggestedModelsForPurpose, type AiProviderPreset } from "@luminaryworks/ai-client/catalog";
import { useCallback, useEffect, useMemo, useState } from "react";
import { mergeModelOptions } from "./merge-model-options";
import type { ListProviderModels } from "./types";

export function useProviderModelOptions({
  listModels,
  providerType,
  baseUrl,
  secret,
  connectionUid,
  currentModel,
  preset,
  purpose,
}: {
  listModels: ListProviderModels;
  providerType?: string;
  baseUrl?: string;
  secret?: string;
  connectionUid?: string;
  currentModel?: string;
  preset?: AiProviderPreset;
  purpose?: string;
}): {
  models: string[];
  source: "live" | "catalog";
  loading: boolean;
  refresh: (override?: { secret?: string; baseUrl?: string }) => Promise<string[]>;
} {
  const catalog = useMemo(
    () => suggestedModelsForPurpose(preset, purpose),
    [preset, purpose],
  );
  const [models, setModels] = useState<string[]>(catalog);
  const [source, setSource] = useState<"live" | "catalog">("catalog");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setModels(catalog);
    setSource("catalog");
    setLoading(false);
  }, [catalog]);

  const refresh = useCallback(
    async (override?: { secret?: string; baseUrl?: string }): Promise<string[]> => {
      const nextSecret = (override?.secret ?? secret)?.trim();
      const nextBaseUrl = (override?.baseUrl ?? baseUrl)?.trim() || undefined;
      if (!providerType || (!nextSecret && !connectionUid)) {
        setModels(catalog);
        setSource("catalog");
        return catalog;
      }
      setLoading(true);
      try {
        const speechPurpose =
          purpose?.includes("stt") && !purpose.includes("chat")
            ? "stt"
            : purpose?.includes("tts") && !purpose.includes("chat") && !purpose.includes("stt")
              ? "tts"
              : "chat";
        const result = await listModels({
          providerType,
          baseUrl: nextBaseUrl,
          ...(nextSecret ? { secret: nextSecret } : {}),
          connectionUid,
          purpose: speechPurpose,
        });
        const next = result.models.length > 0 ? result.models : catalog;
        setModels(next);
        setSource(result.source);
        return next;
      } catch {
        setModels(catalog);
        setSource("catalog");
        return catalog;
      } finally {
        setLoading(false);
      }
    },
    [listModels, providerType, baseUrl, secret, connectionUid, catalog, purpose],
  );

  const options = useMemo(
    () => mergeModelOptions(models, currentModel),
    [currentModel, models],
  );

  return { models: options, source, loading, refresh };
}
