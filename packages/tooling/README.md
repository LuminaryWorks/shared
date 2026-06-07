# @luminary/tooling

LuminaryWorks 共享 Biome preset 与 tsconfig base。五产品继承同一风格。

## 用法

`biome.json`：

```jsonc
{
  "extends": ["@luminary/tooling/biome.base.json"]
}
```

`tsconfig.json`：

```jsonc
{
  "extends": "@luminary/tooling/tsconfig.base.json"
}
```

## 内容

| 文件 | 说明 |
|------|------|
| `biome.base.json` | 通用 preset（双引号、2 空格、行宽 100） |
| `tsconfig.base.json` | strict + 装饰器（NestJS 友好） |
