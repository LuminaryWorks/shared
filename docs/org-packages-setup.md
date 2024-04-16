# LuminaryWorks 组织 — npmjs Trusted Publishing（OIDC）

`@luminaryworks/*` 发到 **npmjs.com 公开包**。GitHub Actions 用 [Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)（OIDC），**CI 不保存 npm token**。

**不要改 GitHub 仓库可见性**：本文件只处理 npm 发包。

## 1. npmjs 组织 / scope

首次发布需要 `@luminaryworks` scope 的管理权：

- 若尚无组织：<https://www.npmjs.com/org/create>（公开包可用免费 org，名称 `luminaryworks`）
- 把 GitHub 发布所用的 npm 账号加成组织 Owner / 有 publish 权限的成员

## 2. 绑定 Trusted Publisher（每个包一次）

在 npmjs 包设置（或组织 **Add package** 的 pending publisher）填写：

| 字段 | 必须等于 |
|------|----------|
| Organization or user | `LuminaryWorks` |
| Repository | `shared` |
| Workflow filename | `publish-packages.yml` |
| Environment | 留空 |
| Allowed actions | `npm publish` |

要对这六个名字都配一遍：

- `@luminaryworks/auth-core`
- `@luminaryworks/auth-react`
- `@luminaryworks/auth-dev-proxy`
- `@luminaryworks/pal`
- `@luminaryworks/entitlement-client`
- `@luminaryworks/notification`

包已存在时也可用：

```bash
npm trust github @luminaryworks/auth-core --repo LuminaryWorks/shared --file publish-packages.yml --allow-publish -y
```

`npm trust` 要求账号开 2FA；**bypass-2FA 的 Granular Token 不能用来跑 trust**。

## 3. CI（`shared` 仓库）

Workflow：`.github/workflows/publish-packages.yml`

- `permissions.id-token: write`
- **没有** `NPM_TOKEN` / `NODE_AUTH_TOKEN`
- 推送到 `master` 或 `main` 即尝试发布；版本已在 npmjs 上则跳过

不需要在 GitHub **Settings → Secrets** 添加任何 npm token。

## 4. 消费方

仓库 `.npmrc`：

```ini
engine-strict=true
@luminaryworks:registry=https://registry.npmjs.org
```

公开包不需要 `read:packages` PAT。

## 5. 误装到 GitHub Packages 时

若 `~/.npmrc` 仍有：

```ini
@luminaryworks:registry=https://npm.pkg.github.com
```

请改为 `https://registry.npmjs.org`。
