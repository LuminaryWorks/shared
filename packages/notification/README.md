# @luminaryworks/notification

LuminaryWorks 平台级 **NotificationModule**（一期：Email）。

- NestJS Dynamic Module：`forRoot` / `forRootAsync`
- 传输：`@nestjs-modules/mailer` + SMTP（推荐 Amazon SES Mail Manager，587 + STARTTLS）
- 契约稳定：不暴露 Nodemailer / Mailer 类型，便于日后升级为独立 Notification Service
- **不**读取 `process.env`；由宿主注入配置
- **不**包含 BullMQ / 业务模板 / 调度

规格：[LuminaryWorks/spec/notification-service.md](https://github.com/LuminaryWorks/LuminaryWorks/blob/master/spec/notification-service.md)

## Install

```bash
pnpm add @luminaryworks/notification
# peer: @nestjs/common @nestjs/core reflect-metadata
```

本地 MetaRepo 开发：

```jsonc
"@luminaryworks/notification": "file:../../LuminaryWorks/shared/packages/notification"
```

```bash
cd LuminaryWorks/shared && pnpm install && pnpm --dir packages/notification build
```

## Usage

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import {
  NotificationModule,
  NotificationService,
} from "@luminaryworks/notification";

@Module({
  imports: [
    ConfigModule,
    NotificationModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>("SMTP_HOST");
        const port = Number(config.get<string>("SMTP_PORT") ?? 587);
        const secureRaw = config.get<string>("SMTP_SECURE");
        const requireTlsRaw = config.get<string>("SMTP_REQUIRE_TLS");
        return {
          email: host
            ? {
                transport: {
                  host,
                  port,
                  user: config.get<string>("SMTP_USER"),
                  pass: config.get<string>("SMTP_PASS"),
                  secure:
                    secureRaw === undefined
                      ? undefined
                      : secureRaw === "true" || secureRaw === "1",
                  requireTLS:
                    requireTlsRaw === undefined
                      ? undefined
                      : requireTlsRaw === "true" || requireTlsRaw === "1",
                },
              }
            : undefined,
        };
      },
    }),
  ],
})
export class AppModule {}
```

```typescript
constructor(private readonly notifications: NotificationService) {}

await this.notifications.sendEmail({
  from: "report@example.com",
  fromName: "Reports",
  to: ["user@example.com"],
  subject: "Hello",
  html: "<p>Hello</p>",
});
```

## Env (host app)

| Variable | Notes |
|----------|--------|
| `SMTP_HOST` | Required to enable Email |
| `SMTP_PORT` | `587` for SES Mail Manager STARTTLS; `465` for implicit TLS |
| `SMTP_USER` / `SMTP_PASS` | SMTP credentials (never commit real values) |
| `SMTP_SECURE` | Optional `true`/`false` |
| `SMTP_REQUIRE_TLS` | Optional; recommend `true` on 587 |

## SES Mail Manager

Authenticated ingress typically uses:

- Port **587**
- `secure=false`, `requireTLS=true` (STARTTLS)
- Verified From identity + Mail Manager **Send to internet** rule

If credentials were ever pasted into a local file or chat, **rotate them in AWS** before production use.

Optional live smoke (uses env vars only):

```bash
# PowerShell example — do not commit values
$env:SMTP_HOST="your-ingress.example.amazonaws.com"
$env:SMTP_PORT="587"
$env:SMTP_REQUIRE_TLS="true"
$env:SMTP_USER="..."
$env:SMTP_PASS="..."
$env:SMOKE_FROM="report@luminaryworks.dev"
$env:SMOKE_TO="you@example.com"
pnpm --dir packages/notification smoke:smtp
```

## Future channels

`NotificationChannel` already reserves `slack` | `teams` | `webhook` | `sms`.  
`isConfigured("slack")` returns `false` until implemented. Later the same `NotificationService` API can proxy to a remote Notification Service.
