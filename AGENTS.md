# shared — Agent 规则（LuminaryWorks 生态）

本仓是 `@luminaryworks/*` 共享库。上线权威：`../../LuminaryWorksDeployment/AGENTS.md`。

- 库变更通常要连带重建依赖它的控制面/产品镜像后再 ship。
- 禁止「只推 shared、不上安装包」却声称线上已更新。
- 用户要上线：同会话进部署仓，新 pack 版本，manifest 钉死 `sources.shared` 与受影响产品 sha。
