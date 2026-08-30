# 发布 @luminaryworks/* 到 npmjs（公开包 + Trusted Publishing）

共享库发到 **[npmjs.com](https://www.npmjs.com)** 的 `@luminaryworks` scope，`access: public`。GitHub 仓库可见性不变。

CI **不使用** `NPM_TOKEN`。`LuminaryWorks/shared` 的 `master` / `main` 有更新时，GitHub Actions 用 **OIDC Trusted Publishing** 自动发布「本地版本号尚未出现在 npmjs 上」的包。

包内不含 IdP 私钥、License 签名私钥或 `serviceApiKey`。生产密钥只放在各产品运行时环境。

## 包与版本

| 包 | 目录 | 当前版本 | 说明 |
|----|------|----------|------|
| `@luminaryworks/auth-core` | `packages/auth-core` | 0.2.3 | NestJS JWKS；`mode=legacy` 必须显式提供 `legacyJwtSecret` |
| `@luminaryworks/auth-react` | `packages/auth-react` | 0.4.1 | Login Experience Adapter + OIDC PKCE（Headless / Hosted） |
| `@luminaryworks/auth-dev-proxy` | `packages/auth-dev-proxy` | 0.2.1 | 同域 `/oidc` + Experience 代理 |
| `@luminaryworks/pal` | `packages/pal` | 0.3.0 | 权限抽象层 |
| `@luminaryworks/entitlement-client` | `packages/entitlement-client` | 0.2.0 | 权益客户端（生产请显式 `ENTITLEMENT_MODE=enforce`） |
| `@luminaryworks/notification` | `packages/notification` | 0.2.0 | 通知（Email） |
| `@luminaryworks/ai-client` | `packages/ai-client` | 0.2.0 | AI 网关客户端（BYOK / 中央 ai-platform） |
| `@luminaryworks/ai-react` | `packages/ai-react` | 0.1.0 | Ant Design BYOK AI 连接表单 |

`@luminary/tooling` 仅 workspace 内部使用，不发布。

## CI 自动发布（Trusted Publishing / OIDC）

触发：推送到 **`LuminaryWorks/shared`** 的 `master` 或 `main`（不是 MetaRepo 根仓）。也可在 Actions 里手动 Run workflow。

已在 npmjs 上的相同版本会跳过，不会覆盖。要发新包：先改对应 `packages/*/package.json` 的 `version`，再 push。

### 一次性：在 npmjs.com 绑定 Trusted Publisher

每个包都要绑定（包尚不存在时，在 **组织/账号 → Add package / pending publisher** 里先建信任，再让 CI 发首版）。字段必须完全一致：

| 字段 | 值 |
|------|-----|
| Publisher | GitHub Actions |
| Organization or user | `LuminaryWorks` |
| Repository | `shared` |
| Workflow filename | `publish-packages.yml` |
| Environment | **留空**（workflow 未使用 GitHub Environment） |
| Allowed actions | `npm publish` |

包列表：`@luminaryworks/ai-client`、`ai-react`、`auth-core`、`auth-react`、`auth-dev-proxy`、`pal`、`entitlement-client`、`notification`。

文档：[Trusted publishing for npm packages](https://docs.npmjs.com/trusted-publishers/)

包已经存在后，也可用 CLI（需账号 2FA，且 **不能** 用 bypass-2FA 的 Granular Token）：

```bash
npm trust github @luminaryworks/auth-core --repo LuminaryWorks/shared --file publish-packages.yml --allow-publish -y
```

对其余七个包重复执行。

### 新包首次发布（ai-client / ai-react 等）

在 npmjs 上为**新包名**绑定 Trusted Publisher（已有包可跳过）。本机需 `npm login` + 账号 2FA：

```bash
npm trust github @luminaryworks/ai-client --repo LuminaryWorks/shared --file publish-packages.yml --allow-publish -y
npm trust github @luminaryworks/ai-react --repo LuminaryWorks/shared --file publish-packages.yml --allow-publish -y
```

或在 npmjs **Add package → pending publisher** 中填写与上表相同字段。完成后 push / 重跑 `publish-packages.yml`。

### 不要做的事

- 不要在 GitHub Secrets 里放 `NPM_TOKEN`（本 workflow 会忽略它）。
- 不要给 `npm publish` 设置 `NODE_AUTH_TOKEN`，否则 CLI 不会走 OIDC。
- 不要改 workflow 文件名；改了必须同步改 npmjs 上的 Trusted Publisher。

## 本地发布（人工 / 2FA）

Trusted Publishing **只在 GitHub-hosted Actions 里生效**。本机仍需 `npm login` + 账号 2FA OTP：

```bash
pnpm install && pnpm build
pnpm publish:packages
```

已存在的版本会失败并跳过该包；只发新版本号。

## 消费方安装

公开包，**不再需要** GitHub Packages PAT，也不必在 `.npmrc` 指定 `@luminaryworks:registry`。仓库可保留：

```ini
engine-strict=true
```

```bash
pnpm add @luminaryworks/auth-core@^0.2.3
pnpm add @luminaryworks/auth-react@^0.4.1
```

**本地改 shared 源码时**：可用 `pnpm.overrides` 临时回退 `file:`，见 [MIGRATION.md](./MIGRATION.md)。日常与测试环境一律用 npmjs 版本。
