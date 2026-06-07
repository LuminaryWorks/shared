# @luminary/auth-core

NestJS 统一 OIDC JWT 验签库，支持：

- **Logto** / 任意 OIDC IdP（JWKS + Discovery）
- **external_oidc** — 企业 Azure AD、Okta、蓝鲸 OIDC 直连
- **legacy** — HS256 本地 JWT（dev）

## 接入前

```bash
cd packages/luminary-auth-core && npm install && npm run build
```

各产品 `package.json` 使用 `"@luminary/auth-core": "file:../packages/luminary-auth-core"`（路径按仓库相对位置调整）。

**注意**：`@nestjs/common` / `@nestjs/core` 为 peerDependency，由宿主 NestJS 项目提供，避免重复安装导致类型冲突。

```typescript
LuminaryAuthModule.forRoot({
  mode: process.env.IDP_ISSUER ? "logto" : "legacy",
  issuer: process.env.IDP_ISSUER,
  audience: process.env.IDP_AUDIENCE,
  legacyJwtSecret: process.env.JWT_SECRET,
  claimsMapping: {
    permissions: "permissions",
    roles: "roles",
    orgId: "org_id",
  },
});
```

Controller 使用 `@LuminaryPublic()` 标记公开路由。

规格：`spec/luminary-identity-federation.md`
