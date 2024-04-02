# @luminaryworks/pal

LuminaryWorks **Permission Abstraction Layer** �?NestJS 库�?
## 用�?
- 业务代码只依�?PAL 接口，不直接绑定蓝鲸 / LDAP / 本地 RBAC �?- 通过 `PAL_ADAPTER` 环境变量�?`PalModule.forRoot()` 切换权限�?
## 安装（Monorepo 内）

```bash
cd packages/luminary-pal && npm install && npm run build
```

各产�?`package.json` 添加�?
```json
"@luminaryworks/pal": "file:../../packages/luminary-pal"
```

## 用法

```typescript
import { PalModule, PalPermissionGuard, RequirePalPermission } from "@luminaryworks/pal";

@Module({
  imports: [
    PalModule.forRoot({
      adapter: process.env.PAL_ADAPTER === "bkiam" ? "bkiam" : "native",
      rbacPort: myRbacPort, // 实现 NativeRbacPort，包装现�?RbacService
    }),
  ],
})
export class AppModule {}

@UseGuards(PalPermissionGuard)
@RequirePalPermission("edu.course", "manage")
@Get("courses")
list() {}
```

## 规格

- `spec/luminary-identity-pal-spec.md`
- `spec/contracts/pal.v1.yaml`

## 迭代

| 版本 | 内容 |
|------|------|
| 0.1.0 | native + composite + bkiam stub |
| 0.2.0 | BkIamPalAdapter 完整实现 (I-4) |
| 0.3.0 | Redis 权限缓存 |
