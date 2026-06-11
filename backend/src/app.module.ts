import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AiModule } from './ai/ai.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import {
  RATE_LIMIT_GLOBAL_MAX,
  RATE_LIMIT_WINDOW_MS,
} from './common/constants/app.constants';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { MongoSanitizeMiddleware } from './common/middleware/mongo-sanitize.middleware';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { HealthController } from './health/health.controller';
import { InvoicesModule } from './invoices/invoices.module';
import { NotificationsModule } from './notifications/notifications.module';
import { UsersModule } from './users/users.module';

/**
 * Application root: configuration, database, security cross-cuts and every
 * feature module.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('mongodbUri'),
      }),
    }),
    // Global limit per IP; auth routes override with a stricter limit
    // via @Throttle (see RATE_LIMIT_AUTH_MAX).
    ThrottlerModule.forRoot([
      { name: 'default', ttl: RATE_LIMIT_WINDOW_MS, limit: RATE_LIMIT_GLOBAL_MAX },
    ]),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    AiModule,
    InvoicesModule,
    AnalyticsModule,
    NotificationsModule,
    ChatModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule implements NestModule {
  /**
   * Registers request-id tracing and NoSQL-injection sanitization on every
   * route.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, MongoSanitizeMiddleware).forRoutes('*');
  }
}
