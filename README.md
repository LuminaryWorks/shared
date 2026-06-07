# LuminaryWorks Shared

`@luminaryworks/*` 共享库的 pnpm 工作�?—�?五产品共用的认证、权限与工具链�?
> 组织：[github.com/LuminaryWorks](https://github.com/LuminaryWorks) · 迁移规格：[ecosystem-refactoring.md](https://github.com/LuminaryWorks/LuminaryWorks/blob/main/spec/ecosystem-refactoring.md)

## �?
| �?| 状�?| 说明 |
|----|------|------|
| `@luminaryworks/tooling` | �?就位 | Biome preset + tsconfig base |
| `@luminaryworks/auth-core` | �?LW-S1 已迁�?| OIDC JWKS 验签（NestJS�?|
| `@luminaryworks/auth-react` | �?LW-S1 已迁�?| OIDC PKCE（React SPA�?|
| `@luminaryworks/pal` | �?LW-S1 已迁�?| 权限抽象�?|

> `DataLuminary-Platform/packages/` 暂保留为**镜像**（标 `@deprecated`），五消费方�?[MIGRATION.md](./MIGRATION.md) �?LW-S2 切换依赖�?
## 开�?
```bash
pnpm install
pnpm build      # 递归构建所有包
pnpm check      # 递归类型检�?```

## 发布

GitHub Packages（`@luminary` scope），当前 **0.2.0**。见 [PUBLISH.md](./PUBLISH.md)�?
```bash
# CI：Actions �?Publish @luminary packages �?Run workflow
pnpm publish:packages   # 本地需 PAT write:packages
```
