# 发布 @luminaryworks/* 到 GitHub Packages

## 包与版本

| 包 | 目录 | 当前版本 | 说明 |
|----|------|----------|------|
| `@luminaryworks/auth-core` | `packages/auth-core` | 0.2.1 | NestJS JWKS |
| `@luminaryworks/auth-react` | `packages/auth-react` | 0.3.0 | Headless + OIDC PKCE |
| `@luminaryworks/auth-dev-proxy` | `packages/auth-dev-proxy` | 0.1.0 | 同域 `/oidc` + Experience 代理 |
| `@luminaryworks/pal` | `packages/pal` | 0.2.0 | 权限抽象层 |
| `@luminaryworks/entitlement-client` | `packages/entitlement-client` | 0.1.0 | 权益客户端 |
| `@luminaryworks/notification` | `packages/notification` | 0.1.0 | 通知（Email） |

`@luminary/tooling` 仅 workspace 内部使用，不发布。

## CI 发布（推荐）

1. 在 GitHub **Actions → Publish @luminaryworks packages → Run workflow**，或
2. 创建 **Release / tag**（如 `v0.3.0`）触发 `release: published`。

Workflow 使用 `GITHUB_TOKEN` 写入 `https://npm.pkg.github.com`。

若 CI 报 `403 installation does not exist`，见 [docs/org-packages-setup.md](./docs/org-packages-setup.md)（组织 Owner 配置 Packages + Actions 写权限）。

## 本地发布

```bash
cp .npmrc.example .npmrc
# PowerShell:
$env:NODE_AUTH_TOKEN = "ghp_..."   # 需含 write:packages
pnpm install && pnpm build
pnpm publish:packages
```

已存在的版本（如 `pal@0.2.0`）会跳过失败；只发新版本号。

## 消费方安装

仓库可提交的 `.npmrc`（只要 registry；**不要**把 token 写进仓库 `.npmrc`，pnpm 也不会展开其中的 `${NODE_AUTH_TOKEN}`）：

```ini
@luminaryworks:registry=https://npm.pkg.github.com
```

本机 `~/.npmrc`：

```ini
//npm.pkg.github.com/:_authToken=<GITHUB_PAT_with_read:packages>
```

CI 用 `actions/setup-node` 的 `registry-url` + `NODE_AUTH_TOKEN` secret。

```bash
pnpm add @luminaryworks/auth-core@^0.2.1
pnpm add @luminaryworks/auth-react@^0.3.0
```

**本地改 shared 源码时**：可用 `pnpm.overrides` 临时回退 `file:`，见 [MIGRATION.md](./MIGRATION.md)。日常与测试环境一律用 registry 版本。
