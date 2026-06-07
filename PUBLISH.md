# 发布 @luminary/* 到 GitHub Packages

## 包与版本

| 包 | 目录 | 当前版本 |
|----|------|----------|
| `@luminary/auth-core` | `packages/auth-core` | 0.2.0 |
| `@luminary/auth-react` | `packages/auth-react` | 0.2.0 |
| `@luminary/pal` | `packages/pal` | 0.2.0 |

`@luminary/tooling` 仅 workspace 内部使用，不发布。

## CI 发布（推荐）

1. 在 GitHub **Actions → Publish @luminary packages → Run workflow**，或
2. 创建 **Release / tag**（如 `v0.2.0`）触发 `release: published`。

Workflow 使用 `GITHUB_TOKEN` 写入 `https://npm.pkg.github.com`。

## 本地发布

```bash
cp .npmrc.example .npmrc
# PowerShell:
$env:NODE_AUTH_TOKEN = gh auth token   # 需含 write:packages
pnpm install && pnpm build
pnpm publish:packages
```

## 消费方安装

各产品仓库根目录或用户 `~/.npmrc`：

```ini
@luminary:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=<GITHUB_PAT_with_read:packages>
```

```bash
pnpm add @luminary/auth-core@^0.2.0
```

**本地开发**（未发包或离线）：`package.json` 使用 `pnpm.overrides` 回退 `file:`，见 [MIGRATION.md](./MIGRATION.md)。
