import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId = (request as any)?.correlationId || 'unknown-corr-id';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errorType = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
        errorType = exception.name;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        message = resObj.message || exception.message;
        errorType = resObj.error || exception.name;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      errorType = exception.name || 'Error';
    }

    // Map status to user-friendly error types if needed
    if (status === HttpStatus.BAD_REQUEST && errorType === 'Error') {
      errorType = 'ValidationError';
    } else if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
      errorType = 'OversizedUploadError';
    } else if (status === HttpStatus.UNSUPPORTED_MEDIA_TYPE) {
      errorType = 'UnsupportedMediaTypeError';
    } else if (status === HttpStatus.TOO_MANY_REQUESTS) {
      errorType = 'RateLimitExceeded';
    } else if (status === HttpStatus.BAD_GATEWAY || status === HttpStatus.SERVICE_UNAVAILABLE) {
      errorType = 'ExternalDependencyError';
    }

    // Sanitize log output: do not log raw request bodies or credentials
    this.logger.error(
      `[${correlationId}] HTTP ${status} ${request.method} ${request.url} - ${errorType}: ${
        Array.isArray(message) ? message.join(', ') : message
      }`,
    );

    response.status(status).json({
      statusCode: status,
      error: errorType,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      correlationId,
    });
  }
}
