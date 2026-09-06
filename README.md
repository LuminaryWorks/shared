# LuminaryWorks Shared

`@luminaryworks/*` 共享库的 pnpm 工作区 —— 六产品共用的认证、权限、权益与工具链。

> 组织：[github.com/LuminaryWorks](https://github.com/LuminaryWorks) · 迁移规格：[ecosystem-refactoring.md](https://github.com/LuminaryWorks/LuminaryWorks/blob/main/spec/ecosystem-refactoring.md)

## 包

| 包 | 状态 | 说明 |
|----|------|------|
| `@luminary/tooling` | workspace 内部 | Biome preset + tsconfig base（不发布） |
| `@luminaryworks/auth-core` | ✅ 0.2.2 | OIDC JWKS 验签（NestJS） |
| `@luminaryworks/auth-react` | ✅ 0.3.1 | Headless + OIDC PKCE（React SPA） |
| `@luminaryworks/auth-dev-proxy` | ✅ 0.1.0 | 同域 `/oidc` + Experience 开发代理 |
| `@luminaryworks/pal` | ✅ 0.2.0 | 权限抽象层 |
| `@luminaryworks/notification` | ✅ 0.1.0 | NotificationModule（SMTP） |
| `@luminaryworks/entitlement-client` | ✅ 0.1.0 | NestJS 权益客户端 |
| `@luminaryworks/control-manifest` | ✅ 0.1.0 | 部署 Control Manifest：profile / 能力协商 / 降级校验 |

> 品牌资源（六产品 Logo + 配色）：[`brand/`](./brand/README.md) — 全生态唯一来源。

## 开发

```bash
pnpm install
pnpm build      # 递归构建所有包
pnpm check      # 递归类型检查
```

## 发布 / 消费

公开包发到 **npmjs.com**（`@luminaryworks` scope）。见 [PUBLISH.md](./PUBLISH.md)、[MIGRATION.md](./MIGRATION.md)。GitHub 仓库权限不变。

```bash
# CI：push 到 LuminaryWorks/shared 的 master/main 即 OIDC 自动发新版本（无需 NPM_TOKEN）
# 本地：pnpm publish:packages（需 npm login + 2FA）
```

消费方：`@luminaryworks/*` 走 npmjs 默认源，仓库 `.npmrc` 不必指定该 scope 的 registry。若本机 `~/.npmrc` 仍指向 GitHub Packages，删掉 `@luminaryworks:registry=https://npm.pkg.github.com` 即可。
