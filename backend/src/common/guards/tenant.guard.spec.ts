import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantGuard, DEFAULT_DEMO_TENANT } from './tenant.guard';

describe('TenantGuard', () => {
  let guard: TenantGuard;
  let mockConfigService: jest.Mocked<Partial<ConfigService>>;

  const createMockContext = (headers: Record<string, string> = {}, query: Record<string, string> = {}): {
    context: ExecutionContext;
    req: any;
  } => {
    const req: any = {
      headers,
      query,
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as unknown as ExecutionContext;

    return { context, req };
  };

  describe('When PUBLIC_ACCESS_ENABLED is true (Default Demo Allowed)', () => {
    beforeEach(() => {
      mockConfigService = {
        get: jest.fn().mockImplementation((key: string, defaultVal: string) => {
          if (key === 'PUBLIC_ACCESS_ENABLED') return 'true';
          return defaultVal;
        }),
      };
      guard = new TenantGuard(mockConfigService as unknown as ConfigService);
    });

    it('should assign DEFAULT_DEMO_TENANT and set isDemo=true when no tenant header is provided', () => {
      const { context, req } = createMockContext();
      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(req.tenantContext).toBeDefined();
      expect(req.tenantContext.tenantId).toBe(DEFAULT_DEMO_TENANT);
      expect(req.tenantContext.isDemo).toBe(true);
      expect(req.tenantContext.isSqlAuthorized).toBe(false);
    });

    it('should assign explicit tenantId and set isDemo=false when x-tenant-id is provided', () => {
      const { context, req } = createMockContext({ 'x-tenant-id': 'tenant-acme' });
      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(req.tenantContext.tenantId).toBe('tenant-acme');
      expect(req.tenantContext.isDemo).toBe(false);
    });

    it('should set isDemo=true when x-demo-mode header is true', () => {
      const { context, req } = createMockContext({
        'x-tenant-id': 'tenant-acme',
        'x-demo-mode': 'true',
      });
      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(req.tenantContext.isDemo).toBe(true);
    });

    it('should populate isSqlAuthorized when x-sql-authorized is true', () => {
      const { context, req } = createMockContext({
        'x-tenant-id': 'tenant-acme',
        'x-sql-authorized': 'true',
      });
      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(req.tenantContext.isSqlAuthorized).toBe(true);
    });

    it('should reject tenant IDs with invalid injection characters', () => {
      const { context } = createMockContext({ 'x-tenant-id': 'tenant/invalid;drop table' });
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('When PUBLIC_ACCESS_ENABLED is false (Strict Auth Policy)', () => {
    beforeEach(() => {
      mockConfigService = {
        get: jest.fn().mockImplementation((key: string, defaultVal: string) => {
          if (key === 'PUBLIC_ACCESS_ENABLED') return 'false';
          return defaultVal;
        }),
      };
      guard = new TenantGuard(mockConfigService as unknown as ConfigService);
    });

    it('should throw UnauthorizedException when no tenant header is passed', () => {
      const { context } = createMockContext();
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow(
        'Tenant identifier is required: unauthenticated public demo access is disabled by server policy.',
      );
    });

    it('should throw ForbiddenException when client attempts to use DEFAULT_DEMO_TENANT', () => {
      const { context } = createMockContext({ 'x-tenant-id': DEFAULT_DEMO_TENANT });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        'Access to default demo tenant is disabled when PUBLIC_ACCESS_ENABLED=false.',
      );
    });

    it('should allow valid explicit tenant identifier', () => {
      const { context, req } = createMockContext({ 'x-tenant-id': 'tenant-enterprise-prod' });
      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(req.tenantContext.tenantId).toBe('tenant-enterprise-prod');
      expect(req.tenantContext.isDemo).toBe(false);
    });
  });
});
