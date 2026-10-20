import { Module, Global } from '@nestjs/common';
import { StorageService } from './storage.service';
import { NotificationService } from './notification.service';

@Global()
@Module({
  providers: [StorageService, NotificationService],
  exports: [StorageService, NotificationService],
})
export class SharedServicesModule {}
