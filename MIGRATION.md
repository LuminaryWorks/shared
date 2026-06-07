# 共享库迁移运行手册

将 `@luminary/auth-core`、`auth-react`、`pal` 从 `DataLuminary-Platform/packages/` 迁入本工作区，并切换五消费方依赖。**分阶段、可回滚、不破坏构建。**

## 消费方现状（LW-S2 已切换至 shared）

| 消费方 | 依赖路径 |
|--------|----------|
| DataTalk | `file:../../../LuminaryWorks/shared/packages/auth-core` |
| VibeEdu server | `file:../../../LuminaryWorks/shared/packages/auth-core` |
| VibeAgent api | `file:../../../../LuminaryWorks/shared/packages/auth-core` |
| VistaRemote server | `file:../../LuminaryWorks/shared/packages/auth-core` |
| iot-gateway | `file:../../../LuminaryWorks/shared/packages/auth-core` |

> 安装前在 `LuminaryWorks/shared` 执行 `pnpm build`，确保 `auth-core/dist` 存在。

## LW-S1 — 源码迁入 + 发布 ✅

已完成（2026-06）：

- `packages/auth-core`、`auth-react`、`pal` 源码已迁入本工作区
- 各包 `tsconfig` extends `@luminary/tooling`
- `pnpm install && pnpm build` 通过

DataLuminary `packages/` 暂保留为镜像（见 `DEPRECATED.md`），指向本仓。

**待办（发布）**：配置 GitHub Packages 后 `pnpm -r publish --access restricted`。

## LW-S2 — 消费方切换 ✅

已将五消费方 `file:` 路径从 `DataLuminary-Platform/packages/` 改为 `LuminaryWorks/shared/packages/auth-core`。

```bash
cd LuminaryWorks/shared && pnpm build
# 各消费方
pnpm install && pnpm run build   # 或 tsc --noEmit
```

## LW-S4 — GitHub Packages 发布

- 版本 **0.2.0**，`publishConfig` → `npm.pkg.github.com`
- CI：`.github/workflows/publish-packages.yml`（`workflow_dispatch` 或 Release）
- 说明：[PUBLISH.md](./PUBLISH.md)

发包后消费方可将 `file:` 换为 `"@luminary/auth-core": "^0.2.0"` + 根目录 `.npmrc`（见 `.npmrc.example`）。

## LW-S3 — 清理 ✅

已删除 `DataLuminary-Platform/packages/` 镜像；规格见 `spec/development/shared-packages.md`。

打 tag `pre-packages-removal` 备份（可选）。

## 回滚

- S1/S2 期间 `file:` 与版本号可经 `pnpm.overrides` 并存
- 每阶段独立 PR + tag，可单独 revert
