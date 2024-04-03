# LuminaryWorks 品牌资源

LuminaryWorks 生态六个组织/产品的官方 Logo 与配色，作为全生态唯一品牌资源源。

## Logo 一览

| 资源 | 文件 | 主色 | 寓意 |
|------|------|------|------|
| **LuminaryWorks**（母品牌） | `luminaryworks-logo.png` | 紫 `#6d5efc` → 青 `#18a0fb` → 薄荷 `#21d4a8` | 放射光束 — 生态的「引路之光」 |
| **DataLuminary** | `dataluminary-logo.png` | 蓝 `#3a84ff` + 金 `#f1ce1a` | 上升数据柱 + 洞察之光 |
| **BlockyEdu** | `blockyedu-logo.png` | 蓝 `#388bfd` + 绿 `#238636` | 拼图积木 — 图形化编程教育 |
| **VistaRemote** | `vistaremote-logo.png` | 蓝 `#1677ff` | 屏幕 + 实时信号 — WebRTC 远程控制 |
| **VibeAgent** | `vibeagent-logo.png` | 靛蓝 `#6366f1` | 节点网格 — 去中心化 Agent / Skill 市场 |
| **LuminaryIoTChain** | `luminaryiotchain-logo.png` | 青→薄荷 + 紫节点 | 设备 + 链路 — IoT 连接 |

## 应用位置

| 产品 | docs 站点 | Web 应用 favicon | README |
|------|-----------|------------------|--------|
| LuminaryWorks | `docs/public/logo.png` + rspress `logo`/`icon` | — | `assets/logo.png` |
| DataLuminary | `ProductWhitePaper/docs/public/brand-logo.png` | DataView `public/images/brand-logo.png` | `assets/logo.png` |
| BlockyEdu | （外部 docs 仓） | code/edu/platform web `public/favicon.png` | `assets/logo.png` |
| VistaRemote | `docs/public/brand-logo.png` | client/admin `public/favicon.png` | `assets/logo.png` |
| VibeAgent | `repos/docs/docs/public/logo.png` | `repos/web/public/favicon.png` | `assets/logo.png` |
| LuminaryIoTChain | — | `iot-console-web/public/favicon.png` | `assets/logo.png` |

## 统一 UI/UX 主题

全生态以 **品牌蓝 `#1677ff`** 为统一主色（VistaRemote 与 Ant Design 5 默认色，作为锚点），青→薄荷渐变作为共享点缀（hero / 高亮，不替代主色）。

| 令牌 | 值 | 用途 |
|------|-----|------|
| `--lw-primary` | `#1677ff` | 主色（按钮、链接、强调） |
| `--lw-primary-hover` | `#4593ff` | hover |
| `--lw-primary-active` | `#0958d9` | active / 深色 |
| `--lw-primary-light` | `#e6f0ff` | 浅底 |
| `--lw-accent-cyan` / `--lw-accent-mint` | `#18a0fb` / `#21d4a8` | 渐变点缀 |
| `--lw-gradient` | `linear-gradient(120deg,#1677ff,#18a0fb,#21d4a8)` | hero 标题 |

资源：
- `tokens.css` — CSS 变量（docs 站点 / 原生样式）
- `ant-theme.ts` — `luminaryAntTheme` / `luminaryColors`（Ant Design `ConfigProvider`）

落地情况：

| 产品 | 主色来源 | 原色 → 统一 |
|------|----------|-------------|
| LuminaryWorks docs | `docs/styles/index.css` `--rp-c-brand` | `#6d5efc` → `#1677ff` |
| DataLuminary DataView | `style/variables/theme/default.scss` 等 | `#3a84ff` → `#1677ff` |
| BlockyEdu (code/edu/platform web) | `src/styles.css` | `#388bfd`/`#0969da` → `#1677ff` |
| VistaRemote client | `styles/_variables.scss` | `#1677ff`（锚点，未变） |
| VibeAgent web + docs | `main.tsx` / `styles/index.css` | `#6366f1` → `#1677ff` |
| LuminaryIoTChain web | `main.tsx` `ConfigProvider` | 默认 → `#1677ff` |

## 设计原则

- **统一气质**：扁平几何、留白充足、可缩放到 16px favicon 不糊
- **家族识别**：母品牌的光束元素在 DataLuminary（洞察之光）、IoTChain（紫色光点节点）中延续
- **各自主色**：沿用每个产品已有的品牌色，避免破坏既有界面风格
- **格式**：当前为 PNG（透明背景）；如需矢量可基于此重绘 SVG

## 更新方式

1. 替换本目录对应 PNG（保持文件名）
2. 重新分发到各仓 `public/` 与 `assets/`（见上表）
3. 提交各仓改动

> 资源由本目录统一维护，请勿在各产品内各自魔改，保持生态视觉一致。
