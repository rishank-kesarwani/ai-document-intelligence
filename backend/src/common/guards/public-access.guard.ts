import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PublicAccessGuard implements CanActivate {
  constructor(@Optional() private readonly configService?: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublicAccessEnabled =
      this.configService?.get<string>('PUBLIC_ACCESS_ENABLED', 'true') === 'true' ||
      (this.configService === undefined && process.env.PUBLIC_ACCESS_ENABLED !== 'false');

    if (!isPublicAccessEnabled) {
      throw new ForbiddenException(
        'Public demo access is disabled by server policy (PUBLIC_ACCESS_ENABLED=false).',
      );
    }

    return true;
  }
}
