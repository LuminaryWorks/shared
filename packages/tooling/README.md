# @luminaryworks/tooling

LuminaryWorks 共享 Biome preset �?tsconfig base。五产品继承同一风格�?
## 用法

`biome.json`�?
```jsonc
{
  "extends": ["@luminaryworks/tooling/biome.base.json"]
}
```

`tsconfig.json`�?
```jsonc
{
  "extends": "@luminaryworks/tooling/tsconfig.base.json"
}
```

## 内容

| 文件 | 说明 |
|------|------|
| `biome.base.json` | 通用 preset（双引号�? 空格、行�?100�?|
| `tsconfig.base.json` | strict + 装饰器（NestJS 友好�?|
