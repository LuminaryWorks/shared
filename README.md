# LuminaryWorks Shared

`@luminaryworks/*` 共享库的 pnpm 工作区 —— 六产品共用的认证、权限、权益与工具链。

> 组织：[github.com/LuminaryWorks](https://github.com/LuminaryWorks) · 迁移规格：[ecosystem-refactoring.md](https://github.com/LuminaryWorks/LuminaryWorks/blob/main/spec/ecosystem-refactoring.md)

## 包

| 包 | 状态 | 说明 |
|----|------|------|
| `@luminary/tooling` | workspace 内部 | Biome preset + tsconfig base（不发布） |
| `@luminaryworks/auth-core` | ✅ 0.2.1 | OIDC JWKS 验签（NestJS） |
| `@luminaryworks/auth-react` | ✅ 0.3.0 | Headless + OIDC PKCE（React SPA） |
| `@luminaryworks/auth-dev-proxy` | ✅ 0.1.0 | 同域 `/oidc` + Experience 开发代理 |
| `@luminaryworks/pal` | ✅ 0.2.0 | 权限抽象层 |
| `@luminaryworks/notification` | ✅ 0.1.0 | NotificationModule（SMTP） |
| `@luminaryworks/entitlement-client` | ✅ 0.1.0 | NestJS 权益客户端 |

> 品牌资源（六产品 Logo + 配色）：[`brand/`](./brand/README.md) — 全生态唯一来源。

## 开发

```bash
pnpm install
pnpm build      # 递归构建所有包
pnpm check      # 递归类型检查
```

## 发布 / 消费

GitHub Packages（`@luminaryworks` scope）。见 [PUBLISH.md](./PUBLISH.md)、[MIGRATION.md](./MIGRATION.md)。

```bash
# CI：Actions → Publish @luminaryworks packages → Run workflow
# 本地：npm publish --registry https://npm.pkg.github.com（需 write:packages）
```

消费方：

```ini
# 仓库 .npmrc（可提交）
@luminaryworks:registry=https://npm.pkg.github.com

# 用户 ~/.npmrc（勿提交）
//npm.pkg.github.com/:_authToken=<PAT read:packages>
```
