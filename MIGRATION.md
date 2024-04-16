# 共享库迁移运行手册

将 `@luminaryworks/*` 从本地 `file:` / GitHub Packages 切换为 **npmjs 公开包**。

## 当前状态（2026-08）

| 包 | 版本 | Registry |
|----|------|----------|
| `@luminaryworks/auth-core` | 0.2.2 | npmjs（公开） |
| `@luminaryworks/auth-react` | 0.3.1 | npmjs（公开） |
| `@luminaryworks/auth-dev-proxy` | 0.1.0 | npmjs（公开） |
| `@luminaryworks/pal` | 0.2.0 | npmjs（公开） |
| `@luminaryworks/entitlement-client` | 0.1.0 | npmjs（公开） |
| `@luminaryworks/notification` | 0.1.0 | npmjs（公开） |

消费方 `package.json` 使用 `^x.y.z`，不再写死 `file:…/LuminaryWorks/shared/...`，也不再指向 GitHub Packages。

## 消费方 `.npmrc`

```ini
engine-strict=true
@luminaryworks:registry=https://registry.npmjs.org
```

删除 `@luminaryworks:registry=https://npm.pkg.github.com` 与对应 `_authToken`。公开包不需要 GitHub Packages 凭证。

若本机 `~/.npmrc` 仍有 `@luminaryworks:registry=https://npm.pkg.github.com`，请改为 `https://registry.npmjs.org`，或依赖仓库内 `.npmrc` 覆盖。

## 本地改 shared 源码（可选）

日常开发直接装 npmjs 版本。只有在改 shared 未发版时，才在产品仓加：

```json
{
  "pnpm": {
    "overrides": {
      "@luminaryworks/auth-core": "file:../../LuminaryWorks/shared/packages/auth-core"
    }
  }
}
```

然后 `pnpm install`。发版后去掉 overrides。

## 发布

见 [PUBLISH.md](./PUBLISH.md)。`LuminaryWorks/shared` 的 `master`/`main` 推送会走 OIDC 自动发布；也可 `gh workflow run publish-packages.yml --repo LuminaryWorks/shared`。
