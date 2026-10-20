import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantContext } from '../types';

export const DEFAULT_DEMO_TENANT = 'tenant-demo-default';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    
    // Read tenant header or query parameter
    const tenantHeader = (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string);
    const sqlAuthHeader = req.headers['x-sql-authorized'] as string;
    
    const isDemo = req.headers['x-demo-mode'] === 'true' || !tenantHeader;
    const tenantId = tenantHeader && tenantHeader.trim().length > 0 ? tenantHeader.trim() : DEFAULT_DEMO_TENANT;

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
