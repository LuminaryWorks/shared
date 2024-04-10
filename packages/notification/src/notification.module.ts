import { MailerModule } from "@nestjs-modules/mailer";
import {
  type DynamicModule,
  Global,
  Module,
  type Provider,
} from "@nestjs/common";
import {
  NOTIFICATION_MODULE_OPTIONS,
  type NotificationModuleAsyncOptions,
  type NotificationModuleOptions,
} from "./contracts";
import { buildMailerOptions } from "./email/mailer-options";
import { EmailChannel } from "./email/email.channel";
import { NotificationService } from "./notification.service";

@Global()
@Module({})
export class NotificationModule {
  static forRoot(options: NotificationModuleOptions): DynamicModule {
    return {
      module: NotificationModule,
      global: true,
      imports: [
        MailerModule.forRoot(buildMailerOptions(options)),
      ],
      providers: [
        { provide: NOTIFICATION_MODULE_OPTIONS, useValue: options },
        EmailChannel,
        NotificationService,
      ],
      exports: [NotificationService],
    };
  }

  static forRootAsync(options: NotificationModuleAsyncOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: NOTIFICATION_MODULE_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: NotificationModule,
      global: true,
      imports: [
        ...(options.imports ?? []),
        MailerModule.forRootAsync({
          imports: options.imports ?? [],
          inject: options.inject ?? [],
          useFactory: async (...args: unknown[]) => {
            const resolved = await options.useFactory(...args);
            return buildMailerOptions(resolved);
          },
        }),
      ],
      providers: [optionsProvider, EmailChannel, NotificationService],
      exports: [NotificationService],
    };
  }
}
