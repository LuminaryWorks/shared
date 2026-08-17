# @luminaryworks/ai-client

Shared AI client for LuminaryWorks products.

- Unset `LUMINARY_AI_BASE_URL`: local BYOK via `ephemeral` credentials.
- Set `LUMINARY_AI_BASE_URL`: forward to central AI Platform (`/v1/chat/complete`, `/v1/chat/stream`, `/v1/embeddings`).

Secrets never appear in returned DTOs. Use `fingerprintSecret` / vault helpers for storage.
