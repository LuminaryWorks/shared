# 发布 @luminaryworks/* �?GitHub Packages

## 包与版本

| �?| 目录 | 当前版本 |
|----|------|----------|
| `@luminaryworks/auth-core` | `packages/auth-core` | 0.2.0 |
| `@luminaryworks/auth-react` | `packages/auth-react` | 0.2.0 |
| `@luminaryworks/pal` | `packages/pal` | 0.2.0 |

`@luminaryworks/tooling` �?workspace 内部使用，不发布�?
## CI 发布（推荐）

1. �?GitHub **Actions �?Publish @luminary packages �?Run workflow**，或
2. 创建 **Release / tag**（如 `v0.2.0`）触�?`release: published`�?
Workflow 使用 `GITHUB_TOKEN` 写入 `https://npm.pkg.github.com`�?
�?CI �?`403 installation does not exist`，见 [docs/org-packages-setup.md](./docs/org-packages-setup.md)（组�?Owner 配置 Packages + Actions 写权限）�?
## 本地发布

```bash
cp .npmrc.example .npmrc
# PowerShell:
$env:NODE_AUTH_TOKEN = gh auth token   # 需�?write:packages
pnpm install && pnpm build
pnpm publish:packages
```

## 消费方安�?
各产品仓库根目录或用�?`~/.npmrc`�?
```ini
@luminary:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=<GITHUB_PAT_with_read:packages>
```

```bash
pnpm add @luminaryworks/auth-core@^0.2.0
```

**本地开�?*（未发包或离线）：`package.json` 使用 `pnpm.overrides` 回退 `file:`，见 [MIGRATION.md](./MIGRATION.md)�?