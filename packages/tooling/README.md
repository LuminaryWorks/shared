# @luminary/tooling

LuminaryWorks 共享工程基线：Biome preset、tsconfig base、`.editorconfig` / `.nvmrc` / `.npmrc` 模板。五产品继承同一风格。

## 用法

### 发布包消费（推荐）

`biome.json`：

```json
{
  "extends": ["@luminary/tooling/biome.backend.json"]
}
```

`tsconfig.json`：

```json
{
  "extends": "@luminary/tooling/tsconfig.base.json"
}
```

### MetaRepo 本地 `tooling/` 目录

子仓通过相对路径继承，例如 `../tooling/biome.backend.json`。  
全生态同步脚本：

```powershell
cd D:\www\LuminaryWorks\shared
.\scripts\sync-engineering-baseline.ps1
```

## 内容

| 文件 | 说明 |
|------|------|
| `biome.base.json` | 通用 preset（双引号、2 空格、行宽 100） |
| `biome.backend.json` | NestJS / API（装饰器、organizeImports off） |
| `biome.frontend.json` | React / Rspress / Rsbuild |
| `biome.server.json` | 服务端仓（extends backend + 测试 overrides） |
| `biome.web.json` | Web 应用仓（extends frontend + React overrides） |
| `tsconfig.base.json` | strict + 装饰器（NestJS 友好） |
| `templates/editorconfig` | 跨编辑器：UTF-8、LF、2 空格 |
| `templates/nvmrc` | Node **24.11.0** |
| `templates/npmrc` | `engine-strict=true` |

## 约定

- **行宽**：Biome `lineWidth: 100`；`.editorconfig` 不设 `max_line_length`
- **引号**：JavaScript/TypeScript 统一双引号
- **Node**：`>=24.0.0`，与 VistaRemote 对齐
