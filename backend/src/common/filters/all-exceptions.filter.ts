import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { REQUEST_ID_HEADER } from '../constants/app.constants';

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
  requestId: string;
  timestamp: string;
  path: string;
}

/**
 * Single exit point for all errors. Normalizes every exception into a
 * consistent JSON envelope, logs unexpected failures with the request id,
 * and never leaks stack traces or internals to clients.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  /**
   * @inheritdoc
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = String(request.headers[REQUEST_ID_HEADER] ?? 'unknown');

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        error = exception.name;
      } else if (typeof body === 'object' && body !== null) {
        const typed = body as { message?: string | string[]; error?: string };
        message = typed.message ?? exception.message;
        error = typed.error ?? exception.name;
      }
    } else {
      // Unexpected error: log full detail server-side, return a generic body.
      const detail = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(
        `Unhandled exception [${requestId}] ${request.method} ${request.url}: ${detail}`,
      );
    }

    if (status >= 500 && exception instanceof HttpException) {
      this.logger.error(
        `HTTP ${status} [${requestId}] ${request.method} ${request.url}: ${exception.message}`,
      );
    }

    const payload: ErrorResponseBody = {
      statusCode: status,
      message,
      error,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // SSE responses may already have headers flushed; guard against double-send.
    if (!response.headersSent) {
      response.status(status).json(payload);
    }
  }
}
