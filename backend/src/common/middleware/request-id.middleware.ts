import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { REQUEST_ID_HEADER } from '../constants/app.constants';

/**
 * Assigns a unique request id to every inbound request (or reuses a valid
 * caller-supplied one) and echoes it back in the response headers so logs
 * can be correlated end to end.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  /**
   * @inheritdoc
   */
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const requestId =
      typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();

    req.headers[REQUEST_ID_HEADER] = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  }
}
