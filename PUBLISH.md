# 发布 @luminaryworks/* 到 npmjs（公开包 + Trusted Publishing）

共享库发到 **[npmjs.com](https://www.npmjs.com)** 的 `@luminaryworks` scope，`access: public`。GitHub 仓库可见性不变。

CI **不使用** `NPM_TOKEN`。`LuminaryWorks/shared` 的 `master` / `main` 有更新时，GitHub Actions 用 **OIDC Trusted Publishing** 发布，并自动把有变更的包 patch +1，再把新版本号 commit 回仓库。

包内不含 IdP 私钥、License 签名私钥或 `serviceApiKey`。生产密钥只放在各产品运行时环境。

## 包

| 包 | 目录 | 说明 |
|----|------|------|
| `@luminaryworks/auth-core` | `packages/auth-core` | NestJS JWKS；`mode=legacy` 必须显式提供 `legacyJwtSecret` |
| `@luminaryworks/auth-react` | `packages/auth-react` | Login Experience Adapter + OIDC PKCE（Headless / Hosted） |
| `@luminaryworks/auth-dev-proxy` | `packages/auth-dev-proxy` | 同域 `/oidc` + Experience 代理 |
| `@luminaryworks/pal` | `packages/pal` | 权限抽象层 |
| `@luminaryworks/entitlement-client` | `packages/entitlement-client` | 权益客户端（生产请显式 `ENTITLEMENT_MODE=enforce`） |
| `@luminaryworks/notification` | `packages/notification` | 通知（Email） |
| `@luminaryworks/ai-client` | `packages/ai-client` | AI 网关客户端（BYOK / 中央 ai-platform） |
| `@luminaryworks/ai-react` | `packages/ai-react` | Ant Design BYOK AI 连接表单 |

版本以各包 `package.json` 与 [npmjs `@luminaryworks`](https://www.npmjs.com/org/luminaryworks) 为准，不必在本文件手写。

`@luminary/tooling` 仅 workspace 内部使用，不发布。

## CI 自动发布与自动升版本

触发：推送到 **`LuminaryWorks/shared`** 的 `master` / `main`，或 Actions 里手动 Run workflow。

对每个可发布包：

1. 本地版本已在 npmjs → **跳过**（除非该目录在上次改 `package.json` version 之后还有源码变更）。
2. 有未发布的源码变更，或手动 Run 时勾选 `force_all` → **自动 bump**（默认 patch）后 `npm publish`。
3. 本地版本已经高于 npmjs（例如本机刚发过首版）→ **不再 bump**，直接发当前号。

发布成功后 workflow 会 commit `packages/*/package.json`（`[skip ci]`），不必每次手改版本号。

手动 Run 可选：

- `bump`：`patch`（默认）/ `minor` / `major`
- `force_all`：所有包都 bump 并发布（即使没有源码变更）

```bash
gh workflow run publish-packages.yml --repo LuminaryWorks/shared
```

## 每个包必须单独绑 Trusted Publisher

**包已经出现在 npmjs 上 ≠ GitHub Actions 能发下一版。** Trusted Publisher 是按包配置的，OIDC 不会从 `auth-react` 继承到 `ai-client`。

首版仍须本机 `npm publish`（npm 不能用 OIDC 创建尚不存在的包名）。首版上去之后，打开该包页面绑一次，之后的 0.x.y 才走流水线。

文档：[Trusted publishing for npm packages](https://docs.npmjs.com/trusted-publishers/)

每个包打开 `https://www.npmjs.com/package/<name>` → **Settings / Package settings → Trusted Publisher → GitHub Actions**。字段必须完全一致：

| 字段 | 值 |
|------|-----|
| Publisher | GitHub Actions |
| Organization or user | `LuminaryWorks` |
| Repository | `shared` |
| Workflow filename | `publish-packages.yml`（只要文件名，不要路径） |
| Environment | **留空**（workflow 未使用 GitHub Environment） |
| Allowed actions | **勾选 `npm publish`** |

包列表：`@luminaryworks/ai-client`、`ai-react`、`auth-core`、`auth-react`、`auth-dev-proxy`、`pal`、`entitlement-client`、`notification`。

**`ai-client` / `ai-react` 本机首发之后，必须立刻给这两个包各绑一次。** 漏绑时 CI 就是 `ENEEDAUTH`。

也可用 CLI（需网页 2FA；**bypass-2FA 的 Granular Token 会 403**）：

```bash
npm trust github @luminaryworks/ai-client --repo LuminaryWorks/shared --file publish-packages.yml --allow-publish -y
npm trust github @luminaryworks/ai-react --repo LuminaryWorks/shared --file publish-packages.yml --allow-publish -y
```

对其余已有包，若 Settings 里已有同样配置则可跳过。

### 不要做的事

- 不要在 GitHub Secrets 里放 `NPM_TOKEN`（本 workflow 会忽略它）。
- 不要给 `npm publish` 设置 `NODE_AUTH_TOKEN`，否则 CLI 不会走 OIDC。
- 不要改 workflow 文件名；改了必须同步改 npmjs 上每个包的 Trusted Publisher。
- Trusted Publisher 的 Environment 不要填值（workflow 没有 `environment:`）。

## 本地发布（仅新包首发 / 2FA）

Trusted Publishing **只在 GitHub-hosted Actions 里生效**。新包名第一次上架仍需本机 `npm login` + 浏览器 2FA：

```bash
cd packages/ai-client && npm publish --access public
```

然后马上在 npmjs 上绑 Trusted Publisher。日常升版本交给 CI。

## 消费方安装

公开包，**不再需要** GitHub Packages PAT，也不必在 `.npmrc` 指定 `@luminaryworks:registry`。仓库可保留：

```ini
engine-strict=true
```

```bash
pnpm add @luminaryworks/ai-client@^0.2.0
pnpm add @luminaryworks/ai-react@^0.1.0
pnpm add @luminaryworks/auth-react@^0.4.1
```

**本地改 shared 源码时**：可用 `pnpm.overrides` 临时回退 `file:`，见 [MIGRATION.md](./MIGRATION.md)。日常与测试环境一律用 npmjs 版本。
