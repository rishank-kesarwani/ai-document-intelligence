import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { TenantContext } from '../types';

export const DEFAULT_DEMO_TENANT = 'tenant-demo-default';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(@Optional() private readonly configService?: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    const isPublicAccessEnabled =
      this.configService?.get<string>('PUBLIC_ACCESS_ENABLED', 'true') === 'true' ||
      (this.configService === undefined && process.env.PUBLIC_ACCESS_ENABLED !== 'false');

    // Read tenant header or query parameter
    const tenantHeader = (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string);
    const sqlAuthHeader = req.headers['x-sql-authorized'] as string;

    // When public access is disabled, anonymous access is rejected
    if (!isPublicAccessEnabled) {
      if (!tenantHeader || tenantHeader.trim().length === 0) {
        throw new UnauthorizedException(
          'Tenant identifier is required: unauthenticated public demo access is disabled by server policy.',
        );
      }

      if (tenantHeader.trim() === DEFAULT_DEMO_TENANT) {
        throw new ForbiddenException(
          'Access to default demo tenant is disabled when PUBLIC_ACCESS_ENABLED=false. Please provide an authorized tenant identifier.',
        );
      }
    }

    const isDemo = isPublicAccessEnabled && (req.headers['x-demo-mode'] === 'true' || !tenantHeader);
    const tenantId =
      tenantHeader && tenantHeader.trim().length > 0 ? tenantHeader.trim() : DEFAULT_DEMO_TENANT;

    // Check basic tenant format (alphanumeric, dashes, underscores) to prevent injection
    if (!/^[a-zA-Z0-9_\-]+$/.test(tenantId)) {
      throw new UnauthorizedException('Invalid tenant identifier format');
    }

    const tenantContext: TenantContext = {
      tenantId,
      isDemo,
      isSqlAuthorized: sqlAuthHeader === 'true',
    };

    (req as any).tenantContext = tenantContext;
    return true;
  }
}
