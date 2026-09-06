"use client";

import { RedoOutlined } from "@ant-design/icons";
import {
  Alert,
  AutoComplete,
  Button,
  Flex,
  Form,
  Input,
  Modal,
  Select,
  Switch,
  Tooltip,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AI_PROVIDER_PRESETS,
  canRefreshProviderModels,
  fieldsForProvider,
  formHasUserInput,
  getProviderPreset,
  hasMultipleBaseUrls,
  pickDefaultModel,
  parsePurposes,
  serializePurposes,
  showPurposeSelect,
  supportedPurposesOf,
  defaultPurposeFor,
} from "@luminaryworks/ai-client/catalog";
import { resolveTranslate } from "./labels";
import type { ModelFormProps } from "./types";
import { useProviderModelOptions } from "./use-provider-model-options";

export function ModelForm({
  form,
  isCreate,
  current,
  managedReady = true,
  vaultReady,
  listModels,
  secretMode = "locked",
  t: tProp,
  purposeExtra,
  purposePlaceholder,
  purposeOptions,
  hidePurpose = false,
  providerSwitchPatch,
  children,
}: ModelFormProps) {
  const t = useMemo(() => resolveTranslate(tProp), [tProp]);
  const providerType = Form.useWatch("providerType", form);
  const baseUrl = Form.useWatch("baseUrl", form);
  const secret = Form.useWatch("secret", form);
  const model = Form.useWatch("model", form);
  const purpose = Form.useWatch("purpose", form);
  const preset = getProviderPreset(providerType || "deepseek");
  const lastLiveKey = useRef("");
  const fetchingRef = useRef(false);
  const [baseUrlSearch, setBaseUrlSearch] = useState("");
  const multiBaseUrl = hasMultipleBaseUrls(preset);
  const hasSavedSecret = Boolean(current?.secretFingerprint);
  const { models, source, loading, refresh } = useProviderModelOptions({
    listModels,
    providerType,
    baseUrl,
    secret,
    connectionUid: current?.uid,
    currentModel: model,
    preset,
    purpose,
  });
  const canRefresh = canRefreshProviderModels({
    secret,
    requiresBaseUrl: preset?.requiresBaseUrl,
    baseUrl,
    hasSavedSecret,
  });
  const showRefresh = Boolean(preset?.secretRequired);
  const rotateSecret = secretMode === "rotate";
  const purposeSelectVisible =
    !hidePurpose && Boolean(purposeOptions?.length) && showPurposeSelect(preset);
  const purposeTextVisible = !hidePurpose && !purposeOptions?.length;
  const purposeChoices = useMemo(() => {
    if (!purposeOptions?.length) return [];
    const allowed = new Set(supportedPurposesOf(preset));
    return purposeOptions.filter((item) => allowed.has(item.value));
  }, [purposeOptions, preset]);

  const providerOptions = useMemo(
    () =>
      AI_PROVIDER_PRESETS.map((item) => ({
        value: item.type,
        label: t(item.labelKey, { defaultValue: item.defaultLabel }),
      })),
    [t],
  );

  const baseUrlOptions = useMemo(() => {
    const listed = (preset?.suggestedBaseUrls ?? []).map((item) => ({
      value: item.value,
      label: t(item.labelKey, { defaultValue: item.defaultLabel }),
    }));
    const seen = new Set(listed.map((item) => item.value));
    const extra: Array<{ value: string; label: string }> = [];
    const currentUrl = baseUrl?.trim();
    if (currentUrl && !seen.has(currentUrl)) {
      extra.push({ value: currentUrl, label: currentUrl });
      seen.add(currentUrl);
    }
    const typed = baseUrlSearch.trim();
    if (typed && !seen.has(typed)) extra.push({ value: typed, label: typed });
    return [...listed, ...extra];
  }, [preset, t, baseUrl, baseUrlSearch]);

  const applyLiveModels = (next: string[]) => {
    if (!isCreate) return;
    const picked = pickDefaultModel(next, form.getFieldValue("model"));
    if (picked) form.setFieldValue("model", picked);
  };

  const fetchLiveModels = async (force: boolean) => {
    const nextSecret = form.getFieldValue("secret") as string | undefined;
    const nextBaseUrl = form.getFieldValue("baseUrl") as string | undefined;
    if (
      fetchingRef.current ||
      loading ||
      !canRefreshProviderModels({
        secret: nextSecret,
        requiresBaseUrl: preset?.requiresBaseUrl,
        baseUrl: nextBaseUrl,
        hasSavedSecret,
      })
    ) {
      return;
    }
    const liveKey = `${providerType}|${nextBaseUrl?.trim() ?? ""}|${nextSecret?.trim() || current?.uid || ""}`;
    if (!force && lastLiveKey.current === liveKey) return;
    fetchingRef.current = true;
    try {
      const next = await refresh({ secret: nextSecret, baseUrl: nextBaseUrl });
      lastLiveKey.current = liveKey;
      applyLiveModels(next);
    } finally {
      fetchingRef.current = false;
    }
  };

  const onProviderChange = (value: string) => {
    if (!isCreate) return;
    const previous = providerType;
    const currentPreset = getProviderPreset(previous || "deepseek");
    const apply = () => {
      const nextPreset = getProviderPreset(value);
      if (!nextPreset) return;
      lastLiveKey.current = "";
      setBaseUrlSearch("");
      form.setFieldsValue({
        providerType: nextPreset.type,
        ...fieldsForProvider(nextPreset),
        ...providerSwitchPatch,
      });
      if (purposeOptions?.length && !providerSwitchPatch?.purpose) {
        form.setFieldValue("purpose", defaultPurposeFor(nextPreset));
      }
    };
    if (
      !formHasUserInput(
        {
          displayName: form.getFieldValue("displayName"),
          model: form.getFieldValue("model"),
          baseUrl: form.getFieldValue("baseUrl"),
          secret: form.getFieldValue("secret"),
          purpose: form.getFieldValue("purpose"),
        },
        currentPreset,
      )
    ) {
      apply();
      return;
    }
    Modal.confirm({
      title: t("ai.switchProviderConfirmTitle"),
      content: t("ai.switchProviderConfirm"),
      onOk: apply,
      onCancel: () => {
        if (previous) form.setFieldValue("providerType", previous);
      },
    });
  };

  useEffect(() => {
    lastLiveKey.current = "";
    if (isCreate || !current?.uid || !hasSavedSecret) return;
    void fetchLiveModels(false);
  }, [current?.uid, isCreate, hasSavedSecret]);

  const refreshDisabledReason = canRefresh
    ? undefined
    : preset?.requiresBaseUrl && !baseUrl?.trim()
      ? t("ai.modelRefreshNeedBaseUrl")
      : t("ai.modelRefreshNeedSecret");

  return (
    <>
      {!vaultReady && (
        <Alert type="error" showIcon style={{ marginBottom: 12 }} message={t("ai.vaultMissing")} />
      )}
      {preset?.type === "luminary-managed" && !managedReady && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={t("ai.managedUnavailable")}
        />
      )}
      <Form form={form} layout="vertical">
        <Form.Item
          name="providerType"
          label={t("ai.provider")}
          rules={[{ required: true }]}
          extra={isCreate ? undefined : t("ai.providerLocked")}
        >
          <Select
            options={providerOptions}
            disabled={!isCreate}
            onChange={isCreate ? onProviderChange : undefined}
          />
        </Form.Item>
        {preset?.secretRequired ? (
          isCreate || rotateSecret ? (
            <Form.Item
              name="secret"
              label={t("ai.secret")}
              rules={
                isCreate ? [{ required: true, message: t("ai.completeForm") }] : undefined
              }
              extra={
                !isCreate && rotateSecret && current?.secretFingerprint
                  ? `${t("ai.secretRotateHint")} ${t("ai.fingerprint")}：${current.secretFingerprint}`
                  : undefined
              }
            >
              <Input.Password
                autoComplete="new-password"
                placeholder={
                  !isCreate && current?.secretFingerprint
                    ? `${t("ai.fingerprint")} · ${current.secretFingerprint}`
                    : undefined
                }
                onBlur={() => {
                  if (!form.getFieldValue("secret")?.trim() && !hasSavedSecret) return;
                  void fetchLiveModels(false);
                }}
              />
            </Form.Item>
          ) : (
            <Form.Item
              label={t("ai.secret")}
              extra={
                <>
                  {t("ai.secretLocked")}
                  {current?.secretFingerprint ? (
                    <div>
                      {t("ai.fingerprint")}：{current.secretFingerprint}
                    </div>
                  ) : null}
                </>
              }
            >
              <Input.Password disabled visibilityToggle={false} defaultValue="••••••••••••" />
            </Form.Item>
          )
        ) : null}
        <Form.Item
          name="baseUrl"
          label={t("ai.baseUrl")}
          rules={preset?.requiresBaseUrl ? [{ required: true }] : []}
          extra={multiBaseUrl ? t("ai.baseUrlListHint") : undefined}
        >
          {multiBaseUrl ? (
            <Select
              showSearch
              allowClear
              options={baseUrlOptions}
              optionFilterProp="label"
              placeholder={t("ai.baseUrlPlaceholder")}
              notFoundContent={t("ai.baseUrlListEmpty")}
              onSearch={setBaseUrlSearch}
              onChange={() => {
                setBaseUrlSearch("");
                if (!form.getFieldValue("secret")?.trim() && !hasSavedSecret) return;
                void fetchLiveModels(false);
              }}
            />
          ) : (
            <AutoComplete
              allowClear
              options={preset?.defaultBaseUrl ? [{ value: preset.defaultBaseUrl }] : []}
              placeholder={
                preset?.requiresBaseUrl ? t("ai.baseUrlRequired") : preset?.defaultBaseUrl
              }
              onBlur={() => {
                if (!form.getFieldValue("secret")?.trim() && !hasSavedSecret) return;
                void fetchLiveModels(false);
              }}
            />
          )}
        </Form.Item>
        <Form.Item
          name="model"
          label={
            <Flex gap="small" align="center">
              <span>{t("ai.defaultModel")}</span>
              {showRefresh ? (
                <Tooltip title={refreshDisabledReason ?? t("ai.modelRefreshHint")}>
                  <span>
                    <Button
                      type="link"
                      size="small"
                      style={{ padding: 0 }}
                      icon={<RedoOutlined />}
                      loading={loading}
                      disabled={!canRefresh}
                      onClick={() => void fetchLiveModels(true)}
                    />
                  </span>
                </Tooltip>
              ) : null}
            </Flex>
          }
          rules={[{ required: true }]}
          extra={
            loading
              ? t("ai.modelListLoading")
              : t(source === "live" ? "ai.modelListLive" : "ai.modelListHint")
          }
        >
          <Select
            showSearch
            loading={loading}
            options={models.map((value) => ({ value, label: value }))}
            optionFilterProp="label"
            placeholder={t("ai.defaultModelPlaceholder")}
            notFoundContent={loading ? t("ai.modelListLoading") : t("ai.modelListEmpty")}
          />
        </Form.Item>
        <Form.Item name="displayName" label={t("ai.displayName")} rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        {purposeSelectVisible ? (
          <Form.Item
            name="purpose"
            label={t("ai.purpose")}
            extra={purposeExtra ?? t("ai.purposeMultiHint")}
            getValueFromEvent={(value: string[]) => serializePurposes(value ?? [])}
            getValueProps={(value: string | undefined) => ({ value: parsePurposes(value) })}
          >
            <Select
              mode="multiple"
              allowClear
              options={purposeChoices}
              placeholder={purposePlaceholder ?? t("ai.purposePlaceholder")}
            />
          </Form.Item>
        ) : purposeTextVisible ? (
          <Form.Item name="purpose" label={t("ai.purpose")} extra={purposeExtra}>
            <Input placeholder={purposePlaceholder ?? t("ai.purposeHint")} />
          </Form.Item>
        ) : hidePurpose ? null : (
          <Form.Item name="purpose" hidden>
            <Input />
          </Form.Item>
        )}
        <Form.Item name="enabled" label={t("ai.enabled")} valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="isDefault" label={t("ai.default")} valuePropName="checked">
          <Switch />
        </Form.Item>
        {children}
      </Form>
    </>
  );
}
