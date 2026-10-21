import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublicAccessGuard } from './public-access.guard';

describe('PublicAccessGuard', () => {
  let guard: PublicAccessGuard;
  let mockConfigService: jest.Mocked<Partial<ConfigService>>;

  const createMockContext = (): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
        }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow access when PUBLIC_ACCESS_ENABLED is true', () => {
    mockConfigService = {
      get: jest.fn().mockReturnValue('true'),
    };
    guard = new PublicAccessGuard(mockConfigService as unknown as ConfigService);
    const context = createMockContext();

    expect(guard.canActivate(context)).toBe(true);
    expect(mockConfigService.get).toHaveBeenCalledWith('PUBLIC_ACCESS_ENABLED', 'true');
  });

  it('should allow access when ConfigService is not provided but process.env is default', () => {
    const origEnv = process.env.PUBLIC_ACCESS_ENABLED;
    delete process.env.PUBLIC_ACCESS_ENABLED;

    guard = new PublicAccessGuard();
    const context = createMockContext();

    expect(guard.canActivate(context)).toBe(true);

    if (origEnv !== undefined) {
      process.env.PUBLIC_ACCESS_ENABLED = origEnv;
    }
  });

  it('should throw ForbiddenException when PUBLIC_ACCESS_ENABLED is false in ConfigService', () => {
    mockConfigService = {
      get: jest.fn().mockReturnValue('false'),
    };
    guard = new PublicAccessGuard(mockConfigService as unknown as ConfigService);
    const context = createMockContext();

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow(
      'Public demo access is disabled by server policy',
    );
  });

  it('should throw ForbiddenException when process.env.PUBLIC_ACCESS_ENABLED is false', () => {
    const origEnv = process.env.PUBLIC_ACCESS_ENABLED;
    process.env.PUBLIC_ACCESS_ENABLED = 'false';

    guard = new PublicAccessGuard();
    const context = createMockContext();

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);

    if (origEnv !== undefined) {
      process.env.PUBLIC_ACCESS_ENABLED = origEnv;
    } else {
      delete process.env.PUBLIC_ACCESS_ENABLED;
    }
  });
});
