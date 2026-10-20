import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const existing = req.headers['x-correlation-id'] as string;
    const correlationId = existing && existing.trim().length > 0 ? existing : uuidv4();
    (req as any).correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
  }
}
