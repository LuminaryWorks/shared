# LuminaryWorks 品牌资源

LuminaryWorks 生态六个组织/产品的官方 Logo 与配色，作为全生态唯一品牌资源源。

## Logo 一览

| 资源 | 文件 | 格式 |
|------|------|------|
| **LuminaryWorks**（母品牌） | `luminaryworks-logo.svg` | SVG |
| **DataLuminary** | `dataluminary-logo.svg` | SVG |
| **BlockyEdu** | `blockyedu-logo.svg` | SVG |
| **SyncroBrain** | `syncrobrain-logo.svg` | SVG |
| **VistaCast** | `vistacast.svg` | SVG |
| **VistaRemote** | `vistaremote-logo.svg` | SVG |
| **DoerFlow** | `doerflow-logo.svg` | SVG |



## CDN 对外地址

图片已上传 Cloudflare R2，对外前缀：

`https://cdn.luminaryworks.dev/logo/`

例如：

- `https://cdn.luminaryworks.dev/logo/luminaryworks-logo.svg`
- `https://cdn.luminaryworks.dev/logo/dataluminary-logo.svg`

Identity 登录页 logo 直接引用 CDN，不再启动本地 `identity-brand` 容器。

## 应用到文档站

宣传站 [`docs`](https://github.com/LuminaryWorks/docs) 使用：

| 位置 | 资源 |
|------|------|
| 导航 / favicon | `docs/docs/public/logo.svg`（同步自 `luminaryworks-logo.svg`） |
| 首页产品卡 | `docs/docs/public/brand/*-logo.svg` |
| 产品页 | 各页顶部引用 `/brand/*.svg` |

更新品牌后，请将本目录文件复制到 `docs/docs/public/brand/`（VistaCast 在 docs 侧命名为 `vistacast-logo.svg`）。

## 统一 UI/UX 主题

全生态以 **品牌蓝 `#1677ff`** 为统一主色，青→薄荷渐变作为共享点缀（hero / 高亮）。

资源：

- `tokens.css` — CSS 变量
- `ant-theme.ts` — Ant Design `ConfigProvider` 主题

## 设计原则

- **统一气质**：扁平几何、留白充足、可缩放到 16px favicon 不糊
- **家族识别**：母品牌光束元素在各产品视觉中延续
- **各自主色**：沿用每个产品已有的品牌色
- **格式**：全系 SVG
