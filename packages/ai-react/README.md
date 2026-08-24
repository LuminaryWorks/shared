# `@luminaryworks/ai-react`

Ant Design form for BYOK AI provider connections. Login stays on `@luminaryworks/auth-react` (no AntD, smaller first paint). Settings pages can depend on React + AntD.

Catalog, suggested models, and regional Base URLs still come from `@luminaryworks/ai-client/catalog`. This package does **not** call vendors; inject `listModels` so the product BFF stays in the middle.

```tsx
import { Form } from "antd";
import { ModelForm, fieldsForProvider, getProviderPreset } from "@luminaryworks/ai-react";

const [form] = Form.useForm();

<ModelForm
  form={form}
  isCreate
  current={null}
  vaultReady
  listModels={(input) => api.listAiProviderModels(input)}
/>
```

| Prop | Notes |
| --- | --- |
| `listModels` | Required. `{ providerType, baseUrl, secret?, connectionUid? }` → `{ source, models }` |
| `t` | Optional `t(key, { defaultValue })`. DataView passes `react-i18next`. Omit for built-in zh labels |
| `secretMode` | `locked` (default, DataLuminary) or `rotate` (VibeLearn / coding account) |
| `purposeOptions` | Select instead of free text |
| `providerSwitchPatch` | Extra fields after switching provider (e.g. `{ purpose: "chat" }`) |

Until published: `file:../../LuminaryWorks/shared/packages/ai-react`.
