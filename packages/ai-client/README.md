# @luminaryworks/ai-client

Shared AI client for LuminaryWorks products.

- **Catalog** (`@luminaryworks/ai-client/catalog`): provider presets, suggested models, regional Base URLs, form helpers. Browser-safe; does **not** import Vault / `node:crypto`.
- **Settings UI**: `@luminaryworks/ai-react` `ModelForm` (AntD). Do not copy DataView's form into other products.
- **List models**: `listProviderModels` merges catalog + live chat IDs. Call from a BFF; the frontend must not send Provider keys to the vendor.
- Unset `LUMINARY_AI_BASE_URL`: local BYOK via `ephemeral` credentials.
- Set `LUMINARY_AI_BASE_URL`: forward to central AI Platform (`/v1/chat/complete`, `/v1/chat/stream`, `/v1/embeddings`).

Secrets never appear in returned DTOs. Use `fingerprintSecret` / vault helpers for storage. Do not import the package root from a browser bundle.

Until this version is published, products may depend on `file:../../LuminaryWorks/shared/packages/ai-client`.
