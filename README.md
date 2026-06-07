# LuminaryWorks Shared

`@luminary/*` 共享库的 pnpm 工作区 —— 五产品共用的认证、权限与工具链。

> 组织：[github.com/LuminaryWorks](https://github.com/LuminaryWorks) · 迁移规格：[ecosystem-refactoring.md](https://github.com/LuminaryWorks/LuminaryWorks/blob/main/spec/ecosystem-refactoring.md)

## 包

| 包 | 状态 | 说明 |
|----|------|------|
| `@luminary/tooling` | ✅ 就位 | Biome preset + tsconfig base |
| `@luminary/auth-core` | ✅ LW-S1 已迁入 | OIDC JWKS 验签（NestJS） |
| `@luminary/auth-react` | ✅ LW-S1 已迁入 | OIDC PKCE（React SPA） |
| `@luminary/pal` | ✅ LW-S1 已迁入 | 权限抽象层 |

> `DataLuminary-Platform/packages/` 暂保留为**镜像**（标 `@deprecated`），五消费方按 [MIGRATION.md](./MIGRATION.md) 在 LW-S2 切换依赖。

## 开发

```bash
pnpm install
pnpm build      # 递归构建所有包
pnpm check      # 递归类型检查
```

## 发布

GitHub Packages，scope `@luminary`。版本遵循 Semver。
