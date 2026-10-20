import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class SqlAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const isFeatureEnabled =
      this.configService.get<string>('FEATURE_NL_SQL_ENABLED', 'true') === 'true';

    if (!isFeatureEnabled) {
      throw new ForbiddenException(
        'Natural-language-to-SQL module is currently disabled by system configuration.',
      );
    }

    const sqlAuthHeader = req.headers['x-sql-authorized'];
    const sqlSecretHeader = req.headers['x-sql-secret'];
    const configuredSecret = this.configService.get<string>('SQL_ACCESS_SECRET');

    const isAuthorized =
      sqlAuthHeader === 'true' ||
      (configuredSecret && sqlSecretHeader === configuredSecret) ||
      (req as any).tenantContext?.isSqlAuthorized;

    if (!isAuthorized) {
      throw new ForbiddenException(
        'Unauthorized: callers must hold explicit SQL querying permissions (header x-sql-authorized: true).',
      );
    }

    return true;
  }
}
