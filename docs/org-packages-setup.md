# LuminaryWorks 组织 — GitHub Packages 开通

CI 发布失败 `403 installation does not exist` 时，需组织 **Owner** 完成以下配置。

## 1. Actions 写入权限

**Organization → Settings → Actions → General → Workflow permissions**

- 选择 **Read and write permissions**
- 勾选 **Allow GitHub Actions to create and approve pull requests**（可选）

## 2. Packages 创建策略

**Organization → Settings → Packages**

- **Package creation**：允许成员发布（或限制为指定团队）
- 确认 `LuminaryWorks/shared` 仓库可创建 `@luminaryworks/*` 包

## 3. 仓库 Actions 权限

**Repository `shared` → Settings → Actions → General**

- Workflow permissions：**Read and write**
- 或继承组织默认（须为 Read and write）

## 4. 重新发布

```bash
gh workflow run publish-packages.yml --repo LuminaryWorks/shared
```

或创建 Release tag `v0.2.0`。

## 5. 消费方 CI / 本地 PAT

若消费方 workflow 使用 `NODE_AUTH_TOKEN: ${{ secrets.GH_PACKAGES_READ_TOKEN || secrets.GITHUB_TOKEN }}`：
当默认 `GITHUB_TOKEN` 权限不足时，在仓库 **Settings → Secrets** 添加 `GH_PACKAGES_READ_TOKEN`（Classic PAT，scope 含 `read:packages`）。

本地 `~/.npmrc`（勿提交 token 到仓库 `.npmrc`）：

```ini
@luminaryworks:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=<PAT>
```

仓库内只需：

```ini
@luminaryworks:registry=https://npm.pkg.github.com
```

## 6. 过渡期

在包未成功发布前，五消费方继续使用 `file:../../../LuminaryWorks/shared/packages/auth-core` + 本地 `pnpm build`。
