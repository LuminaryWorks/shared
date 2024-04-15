# 共享库迁移运行手册

将 `@luminaryworks/*` 从本地 `file:` 切换为 GitHub Packages 版本依赖。

## 当前状态（2026-08）

| 包 | 版本 | Registry |
|----|------|----------|
| `@luminaryworks/auth-core` | 0.2.1 | ✅ |
| `@luminaryworks/auth-react` | 0.3.1 | ✅ |
| `@luminaryworks/auth-dev-proxy` | 0.1.0 | ✅ |
| `@luminaryworks/pal` | 0.2.0 | ✅ |
| `@luminaryworks/entitlement-client` | 0.1.0 | ✅ |
| `@luminaryworks/notification` | 0.1.0 | ✅ |

消费方 `package.json` 使用 `^x.y.z`，不再写死 `file:…/LuminaryWorks/shared/...`。

## 消费方 `.npmrc`

```ini
@luminaryworks:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

本机把 PAT 写在 `~/.npmrc`，或设置环境变量 `NODE_AUTH_TOKEN`（需 `read:packages`）。

## 本地改 shared 源码（可选）

日常开发直接装 registry 版本。只有在改 shared 未发版时，才在产品仓加：

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

见 [PUBLISH.md](./PUBLISH.md)。CI：`gh workflow run publish-packages.yml --repo LuminaryWorks/shared`。
