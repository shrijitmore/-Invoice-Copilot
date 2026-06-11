import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { sanitizeMongoPayload } from '../utils/sanitize.util';

/**
 * Removes MongoDB operator keys (`$gt`, dotted paths, etc.) from request
 * bodies, params and query strings to prevent NoSQL injection.
 */
@Injectable()
export class MongoSanitizeMiddleware implements NestMiddleware {
  /**
   * @inheritdoc
   */
  use(req: Request, _res: Response, next: NextFunction): void {
    if (req.body) {
      sanitizeMongoPayload(req.body);
    }
    if (req.params) {
      sanitizeMongoPayload(req.params);
    }
    if (req.query) {
      sanitizeMongoPayload(req.query);
    }
    next();
  }
}
