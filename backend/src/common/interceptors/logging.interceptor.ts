import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const { method, originalUrl } = req;
    const correlationId = (req as any).correlationId || '-';
    const tenantId = (req as any).tenantContext?.tenantId || 'anonymous';
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;
        this.logger.log(
          `[${correlationId}] [Tenant:${tenantId}] ${method} ${originalUrl} ${statusCode} +${duration}ms`,
        );
      }),
    );
  }
}
