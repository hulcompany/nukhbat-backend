import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Notification } from './entity/notification.entity';
import { DeviceToken } from './entity/device-token.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { FirebaseModule } from '../firebase/firebase-module';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, DeviceToken]) , FirebaseModule],
  controllers: [NotificationsController],
  providers: [NotificationsService,],
  exports: [NotificationsService],
})
export class NotificationsModule {}
