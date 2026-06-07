# 共享库迁移运行手册

将 `@luminary/auth-core`、`auth-react`、`pal` 从 `DataLuminary-Platform/packages/` 迁入本工作区，并切换五消费方依赖。**分阶段、可回滚、不破坏构建。**

## 消费方现状（file: 引用）

| 消费方 | 当前依赖路径 |
|--------|--------------|
| DataTalk | `file:../packages/luminary-auth-core` |
| VibeEdu server | `@luminary/auth-core`（file:） |
| VibeAgent api | `file:` 相对路径 |
| VistaRemote server | `file:../../DataLuminary/DataLuminary-Platform/packages/luminary-auth-core` |
| iot-gateway | `file:../../../DataLuminary/DataLuminary-Platform/packages/luminary-auth-core` |

## LW-S1 — 源码迁入 + 发布

```bash
# 1. 复制源码（保留 git 历史可用 git filter-repo，简单起见直接复制）
cp -r DataLuminary-Platform/packages/luminary-auth-core  shared/packages/auth-core
cp -r DataLuminary-Platform/packages/luminary-auth-react shared/packages/auth-react
cp -r DataLuminary-Platform/packages/luminary-pal        shared/packages/pal

# 2. 各包 extends 共享 tsconfig；workspace 引用 @luminary/tooling
# 3. 配置 GitHub Packages 发布
cd shared && pnpm install && pnpm build
pnpm -r publish --access restricted
```

DataLuminary `packages/` 暂保留为镜像，标 `@deprecated`，指向 shared。

## LW-S2 — 消费方切换（逐仓一 PR）

每个消费方：

```jsonc
// before
"@luminary/auth-core": "file:.../packages/luminary-auth-core"
// after
"@luminary/auth-core": "^0.2.0"
```

```bash
pnpm install && pnpm run lint   # 或 tsc --noEmit，确认 CI 绿
```

顺序建议：iot-gateway → VistaRemote → VibeAgent → VibeEdu → DataTalk（影响面从小到大）。

## LW-S3 — 清理

```bash
# 五仓全部切换且 CI 绿后
git -C DataLuminary-Platform rm -r packages/
```

打 tag `pre-packages-removal` 备份。

## 回滚

- S1/S2 期间 `file:` 与版本号可经 `pnpm.overrides` 并存
- 每阶段独立 PR + tag，可单独 revert
