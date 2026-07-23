import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionKey } from './entity/subscription-key.entity';
import { Subscription } from './entity/subscription.entity';
import { SubscriptionKeyService } from './service/subscription-key.service';
import { SubscriptionService } from './service/subscription.service';
import { SubscriptionController } from './subscription.controller';
import { StudentModule } from '../student/student.module';
import { SchoolModule } from '../school/school.module';
import { SchoolAccessModule } from '../school-access/school-access.module';

require('./errors');

@Module({
  imports: [
    TypeOrmModule.forFeature([SubscriptionKey, Subscription]),
    StudentModule,
    SchoolModule,
    SchoolAccessModule,
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionKeyService, SubscriptionService],
  exports: [SubscriptionKeyService, SubscriptionService, StudentModule],
})
export class SubscriptionModule {}
