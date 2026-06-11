import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { REQUEST_ID_HEADER } from '../constants/app.constants';

/**
 * Structured request logging: method, path, status, duration and request id.
 * Bodies, cookies and auth headers are intentionally never logged.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  /**
   * @inheritdoc
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const requestId = String(request.headers[REQUEST_ID_HEADER] ?? 'unknown');
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startedAt;
          this.logger.log(
            JSON.stringify({
              requestId,
              method: request.method,
              path: request.path,
              statusCode: response.statusCode,
              durationMs: duration,
            }),
          );
        },
      }),
    );
  }
}
